class AlbumsHandler {
  constructor(service, storageService, validator) {
    this._service = service;
    this._storageService = storageService;
    this._validator = validator;

    this.postAlbumHandler = this.postAlbumHandler.bind(this);
    this.getAlbumByIdHandler = this.getAlbumByIdHandler.bind(this);
    this.putAlbumByIdHandler = this.putAlbumByIdHandler.bind(this);
    this.deleteAlbumByIdHandler = this.deleteAlbumByIdHandler.bind(this);
    this.postAlbumCoversHandler = this.postAlbumCoversHandler.bind(this);
    this.postLikesAlbumHandler = this.postLikesAlbumHandler.bind(this);
    this.getLikesAlbumHandler = this.getLikesAlbumHandler.bind(this);
  }

  async postAlbumHandler(request, h) {
    this._validator.validateAlbumPayload(request.payload);
    const albumId = await this._service.addAlbum(request.payload);

    const response = h.response({
      status: 'success',
      message: 'Album berhasil ditambahkan',
      data: {
        albumId,
      },
    });
    response.code(201);
    return response;
  }

  async getAlbumByIdHandler(request) {
    const { id } = request.params;
    const album = await this._service.getAlbumSongsById(id);
    return {
      status: 'success',
      data: {
        album,
      },
    };
  }

  async putAlbumByIdHandler(request) {
    this._validator.validateAlbumPayload(request.payload);
    const { id } = request.params;

    await this._service.editAlbumById(id, request.payload);
    return {
      status: 'success',
      message: 'Album berhasil diperbarui',
    };
  }

  async deleteAlbumByIdHandler(request) {
    const { id } = request.params;
    await this._service.deleteAlbumById(id);
    return {
      status: 'success',
      message: 'Album berhasil dihapus',
    };
  }

  async postAlbumCoversHandler(request, h) {
    const { id } = request.params;
    const { cover } = request.payload;
    this._validator.validateAlbumCover(cover.hapi.headers);
    await this._service.getAlbumSongsById(id);
    const coverUrl = await this._storageService.writeFile(cover);
    await this._service.updateAlbumCoverById(id, coverUrl);

    const response = h.response({
      status: 'success',
      message: 'Sampul berhasil diunggah',
    });
    response.code(201);
    return response;
  }

  async postLikesAlbumHandler(request, h) {
    const { id } = request.params;
    const { id: credentialId } = request.auth.credentials;
    await this._service.likesAlbumById(id, credentialId);

    const response = h.response({
      status: 'success',
      message: 'berhasil melakukan aksi',
    });
    response.code(201);
    return response;
  }

  async getLikesAlbumHandler(request, h) {
    const { id } = request.params;
    const { isFromCache, likes } = await this._service.getLikesAlbumById(id);
    const response = h.response({
      status: 'success',
      data: {
        likes,
      },
    });
    if (isFromCache) response.header('X-Data-Source', 'cache');
    return response;
  }
}

module.exports = AlbumsHandler;
