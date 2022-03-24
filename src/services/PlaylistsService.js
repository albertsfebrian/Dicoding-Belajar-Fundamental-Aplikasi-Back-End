const { Pool } = require('pg');
const { nanoid } = require('nanoid');
const InvariantError = require('../exceptions/InvariantError');
const NotFoundError = require('../exceptions/NotFoundError');
const AuthorizationError = require('../exceptions/AuthorizationError');

class PlaylistsService {
  constructor(collaborationService, songService) {
    this._pool = new Pool();
    this._collaborationService = collaborationService;
    this._songsService = songService;
  }

  async addPlaylist({ name, owner }) {
    const id = `playlist-${nanoid(16)}`;

    const query = {
      text: 'INSERT INTO playlists VALUES($1, $2, $3) RETURNING id',
      values: [id, name, owner],
    };
    const result = await this._pool.query(query);
    if (!result.rows[0].id) {
      throw new InvariantError('Playlist gagal ditambahkan');
    }
    return result.rows[0].id;
  }

  async getPlaylists(owner) {
    const query = {
      text: `
        SELECT playlists.id, playlists.name, users.username FROM playlists
        LEFT JOIN collaborations ON collaborations.playlist_id = playlists.id
        LEFT JOIN users ON users.id = playlists.owner
        WHERE playlists.owner = $1 OR collaborations.user_id = $1
      `,
      values: [owner],
    };
    const result = await this._pool.query(query);
    return result.rows;
  }

  async deletePlaylistById(id) {
    const query = {
      text: 'DELETE FROM playlists WHERE id = $1 RETURNING id',
      values: [id],
    };

    const result = await this._pool.query(query);
    if (!result.rows.length) {
      throw new NotFoundError('Playlist gagal dihapus. Id tidak ditemukan');
    }
  }

  async verifyPlaylistOwner(id, owner) {
    const query = {
      text: 'SELECT * FROM playlists WHERE id = $1',
      values: [id],
    };
    const result = await this._pool.query(query);
    if (!result.rows.length) {
      throw new NotFoundError('Playlist tidak ditemukan');
    }
    const playlist = result.rows[0];
    if (playlist.owner !== owner) {
      throw new AuthorizationError('Anda tidak berhak mengakses resource ini');
    }
  }

  async verifyPlaylistAccess(id, userId) {
    try {
      await this.verifyPlaylistOwner(id, userId);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      try {
        await this._collaborationService.verifyCollaborator(id, userId);
      } catch {
        throw error;
      }
    }
  }

  async recordPlaylistActivity(props) {
    const {
      playlistId, songId, userId, action,
    } = props;
    const time = new Date().toISOString();
    const id = `playlist-activity-${nanoid(16)}`;

    const query = {
      text: 'INSERT INTO playlist_song_activities VALUES($1, $2, $3, $4, $5, $6) RETURNING id',
      values: [id, playlistId, songId, userId, action, time],
    };

    const result = await this._pool.query(query);
    if (!result.rows[0].id) {
      throw new InvariantError('Aktifitas Playlist gagal ditambahkan');
    }
    return result.rows[0].id;
  }

  async getPlaylistActivity(id) {
    const query = {
      text: `
        SELECT users.username, songs.title, playlist_song_activities.action, playlist_song_activities.time 
        FROM playlist_song_activities
        LEFT JOIN users ON users.id = playlist_song_activities.user_id
        LEFT JOIN songs ON songs.id = playlist_song_activities.song_id
        WHERE playlist_song_activities.playlist_id = $1
      `,
      values: [id],
    };
    const result = await this._pool.query(query);
    return result.rows;
  }

  async addSongToPlaylist(id, songId, userId) {
    await this._songsService.getSongById(songId);

    const playlistSongid = `playlist-song-${nanoid(16)}`;
    const query = {
      text: 'INSERT INTO playlist_songs VALUES($1, $2, $3) RETURNING id',
      values: [playlistSongid, id, songId],
    };

    const result = await this._pool.query(query);
    if (!result.rows[0].id) {
      throw new InvariantError('Musik gagal ditambahkan ke Playlist');
    }
    await this.recordPlaylistActivity({
      playlistId: id, songId, userId, action: 'add',
    });
    return result.rows[0].id;
  }

  async getSongsAtPlaylist(id) {
    const playListquery = {
      text: `
        SELECT playlists.id, playlists.name, users.username FROM playlists
        LEFT JOIN collaborations ON collaborations.playlist_id = playlists.id
        LEFT JOIN users ON users.id = playlists.owner
        WHERE playlists.id = $1
      `,
      values: [id],
    };
    const playlist = await this._pool.query(playListquery);
    if (!playlist.rows.length) {
      throw new NotFoundError('Playlist tidak ditemukan');
    }

    const query = {
      text: `
        SELECT songs.id, songs.title, songs.performer FROM playlist_songs
        LEFT JOIN songs ON songs.id = playlist_songs.song_id
        WHERE playlist_songs.playlist_id = $1
      `,
      values: [id],
    };

    const songs = await this._pool.query(query);
    const dataReturn = {
      ...playlist.rows[0],
      songs: songs.rows,
    };
    return dataReturn;
  }

  async deleteSongFromPlaylist(id, songId, userId) {
    const query = {
      text: 'DELETE FROM playlist_songs WHERE playlist_id = $1 AND song_id = $2 RETURNING id',
      values: [id, songId],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new InvariantError('Musik gagal dihapus dari Playlist');
    }
    await this.recordPlaylistActivity({
      playlistId: id, songId, userId, action: 'delete',
    });
  }
}

module.exports = PlaylistsService;
