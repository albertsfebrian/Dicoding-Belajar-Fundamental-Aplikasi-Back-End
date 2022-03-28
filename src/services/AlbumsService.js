const { Pool } = require('pg');
const { nanoid } = require('nanoid');
const InvariantError = require('../exceptions/InvariantError');
const NotFoundError = require('../exceptions/NotFoundError');
const { mapDBToModel } = require('../utils/albums');
const AuthorizationError = require('../exceptions/AuthorizationError');
const { CACHE_ALBUM_LIKE_KEY } = require('../constants');

class AlbumsService {
  constructor(cacheService) {
    this._pool = new Pool();
    this._cacheService = cacheService;
  }

  async addAlbum({ name, year }) {
    const id = `album-${nanoid(16)}`;
    const createdAt = new Date().toISOString();
    const updatedAt = createdAt;
    const cover = null;

    const query = {
      text: 'INSERT INTO albums VALUES($1, $2, $3, $4, $5, $6) RETURNING id',
      values: [id, name, year, cover, createdAt, updatedAt],
    };

    const result = await this._pool.query(query);
    if (!result.rows[0].id) {
      throw new InvariantError('Album gagal ditambahkan');
    }
    await this._cacheService.delete(`${CACHE_ALBUM_LIKE_KEY}:${id}`);
    return result.rows[0].id;
  }

  async getAlbumById(id) {
    const query = {
      text: 'SELECT * FROM albums WHERE id = $1',
      values: [id],
    };
    const result = await this._pool.query(query);
    if (!result.rows.length) {
      throw new NotFoundError('Album tidak ditemukan');
    }
    return result.rows.map(mapDBToModel)[0];
  }

  async getAlbumSongsById(id) {
    const normalizedAlbum = await this.getAlbumById(id);
    const songsQuery = {
      text: 'SELECT id, title, performer FROM songs WHERE album_id = $1',
      values: [id],
    };
    const songsResult = await this._pool.query(songsQuery);

    const joinedAlbum = {
      ...normalizedAlbum,
      songs: songsResult.rows,
    };
    return joinedAlbum;
  }

  async editAlbumById(id, { name, year }) {
    const updatedAt = new Date().toISOString();
    const query = {
      text: 'UPDATE albums SET name = $1, year = $2, updated_at = $3 WHERE id = $4 RETURNING id',
      values: [name, year, updatedAt, id],
    };

    const result = await this._pool.query(query);
    if (!result.rows.length) {
      throw new NotFoundError('Gagal memperbarui album. Id tidak ditemukan');
    }
  }

  async deleteAlbumById(id) {
    const query = {
      text: 'DELETE FROM albums WHERE id = $1 RETURNING id',
      values: [id],
    };

    const result = await this._pool.query(query);
    if (!result.rows.length) {
      throw new NotFoundError('Album gagal dihapus. Id tidak ditemukan');
    }
    this.deleteAllLikeAlbum(id);
  }

  async updateAlbumCoverById(id, coverUrl) {
    const updatedAt = new Date().toISOString();
    const query = {
      text: 'UPDATE albums SET cover = $1, updated_at = $2 WHERE id = $3 RETURNING id',
      values: [coverUrl, updatedAt, id],
    };

    const result = await this._pool.query(query);
    if (!result.rows.length) {
      throw new NotFoundError('Gagal memperbarui album. Id tidak ditemukan');
    }
  }

  async addLikeAlbum(albumId, userId) {
    const id = `album-likes-${nanoid(16)}`;

    const query = {
      text: 'INSERT INTO user_album_likes VALUES($1, $2, $3) RETURNING id',
      values: [id, userId, albumId],
    };

    const result = await this._pool.query(query);
    if (!result.rows[0].id) {
      throw new InvariantError('Like gagal ditambahkan');
    }
    await this._cacheService.delete(`${CACHE_ALBUM_LIKE_KEY}:${albumId}`);
    return result.rows[0].id;
  }

  async deleteAllLikeAlbum(albumId) {
    const query = {
      text: 'DELETE FROM user_album_likes WHERE album_id = $1 RETURNING id',
      values: [albumId],
    };

    await this._pool.query(query);
    await this._cacheService.delete(`${CACHE_ALBUM_LIKE_KEY}:${albumId}`);
  }

  async deleteLikeAlbum(albumId, userId) {
    const query = {
      text: 'DELETE FROM user_album_likes WHERE user_id = $1 AND album_id = $2 RETURNING id',
      values: [userId, albumId],
    };

    const result = await this._pool.query(query);
    if (!result.rows.length) {
      throw new NotFoundError('Like gagal dihapus. data tidak ditemukan');
    }
    await this._cacheService.delete(`${CACHE_ALBUM_LIKE_KEY}:${albumId}`);
  }

  async isAlbumLiked(albumId, userId) {
    const query = {
      text: 'SELECT * FROM user_album_likes WHERE user_id = $1 AND album_id = $2',
      values: [userId, albumId],
    };
    const result = await this._pool.query(query);
    if (result.rows.length === 0) {
      return false;
    }
    return true;
  }

  async likesAlbumById(albumId, userId) {
    if (!userId) {
      throw new AuthorizationError('Anda tidak berhak mengakses resource ini');
    }
    await this.getAlbumById(albumId);
    const isAlbumLiked = await this.isAlbumLiked(albumId, userId);
    if (isAlbumLiked) {
      this.deleteLikeAlbum(albumId, userId);
    } else {
      this.addLikeAlbum(albumId, userId);
    }
  }

  async getLikesAlbumById(id) {
    try {
      const likeCount = await this._cacheService.get(`${CACHE_ALBUM_LIKE_KEY}:${id}`);
      return { isFromCache: true, likes: parseInt(likeCount, 10) };
    } catch (error) {
      const query = {
        text: 'SELECT * FROM user_album_likes WHERE album_id = $1',
        values: [id],
      };
      const result = await this._pool.query(query);
      const likesCount = result.rows.length;
      await this._cacheService.set(`${CACHE_ALBUM_LIKE_KEY}:${id}`, likesCount);
      return { isFromCache: false, likes: likesCount };
    }
  }
}

module.exports = AlbumsService;
