const { Pool } = require('pg');

class PlaylistsService {
  constructor() {
    this._pool = new Pool();
  }

  async getPlaylistDetails(id) {
    const playListquery = {
      text: `
        SELECT playlists.id, playlists.name FROM playlists
        LEFT JOIN collaborations ON collaborations.playlist_id = playlists.id
        LEFT JOIN users ON users.id = playlists.owner
        WHERE playlists.id = $1
      `,
      values: [id],
    };
    const playlist = await this._pool.query(playListquery);
    if (!playlist.rows.length) {
      throw new Error('Playlist tidak ditemukan');
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
}

module.exports = PlaylistsService;
