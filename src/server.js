require('dotenv').config();

const Hapi = require('@hapi/hapi');
const Jwt = require('@hapi/jwt');
const path = require('path');
// Albums
const albums = require('./api/albums');
const AlbumsService = require('./services/AlbumsService');
const AlbumsValidator = require('./validator/albums');
// Songs
const songs = require('./api/songs');
const SongsService = require('./services/SongsService');
const SongsValidator = require('./validator/songs');
// Users
const users = require('./api/users');
const UsersService = require('./services/UsersService');
const UsersValidator = require('./validator/users');
// Authentications
const authentications = require('./api/authentications');
const AuthenticationsService = require('./services/AuthenticationsService');
const TokenManager = require('./tokenize/TokenManager');
const AuthenticationsValidator = require('./validator/authentications');
// Collaborations
const collaborations = require('./api/collaborations');
const CollaborationsService = require('./services/CollaborationsService');
const CollaborationsValidator = require('./validator/collaborations');
// Playlists
const playlists = require('./api/playlists');
const PlaylistsService = require('./services/PlaylistsService');
const PlaylistsValidator = require('./validator/playlists');
// Exports
const _exports = require('./api/exports');
const ProducerService = require('./services/ProducerService');
const ExportsValidator = require('./validator/exports');
// Storage
const StorageService = require('./services/StorageService');
// Cache
const CacheService = require('./services/CacheService');

// Error
const ClientError = require('./exceptions/ClientError');

const init = async () => {
  const cacheService = new CacheService();
  const albumsService = new AlbumsService(cacheService);
  const songsService = new SongsService();
  const usersService = new UsersService();
  const authenticationsService = new AuthenticationsService();
  const collaborationsService = new CollaborationsService(usersService);
  const playlistsService = new PlaylistsService(collaborationsService, songsService);
  const storageService = new StorageService(path.resolve(__dirname, 'uploads'));

  const server = Hapi.server({
    port: process.env.PORT,
    host: process.env.HOST,
    routes: {
      cors: {
        origin: ['*'],
      },
    },
  });

  await server.register([
    {
      plugin: Jwt,
    },
  ]);

  server.auth.strategy('musicapp_jwt', 'jwt', {
    keys: process.env.ACCESS_TOKEN_KEY,
    verify: {
      aud: false,
      iss: false,
      sub: false,
      maxAgeSec: process.env.ACCESS_TOKEN_AGE,
    },
    validate: (artifacts) => ({
      isValid: true,
      credentials: {
        id: artifacts.decoded.payload.id,
      },
    }),
  });

  server.ext('onPreResponse', (request, h) => {
    const { response } = request;

    if (response instanceof ClientError) {
      const newResponse = h.response({
        status: 'fail',
        message: response.message,
      });
      newResponse.code(response.statusCode);
      return newResponse;
    }
    if (response instanceof Error) {
      const { output = {} } = response;
      const { statusCode, message } = output;
      console.error(response);
      if (statusCode === 413) {
        return response;
      }
      if (statusCode === 415) {
        const newResponse = h.response({
          status: 'fail',
          message: 'Unsupported Media Type',
        });
        newResponse.code(400);
        return newResponse;
      }
      if (statusCode === 401) {
        const newResponse = h.response({
          status: 'fail',
          message,
        });
        newResponse.code(401);
        return newResponse;
      }

      const newResponse = h.response({
        status: 'error',
        message: 'Maaf, terjadi kegagalan pada server kami.',
      });
      newResponse.code(500);
      console.error(response);
      return newResponse;
    }

    return response.continue || response;
  });

  await server.register([
    {
      plugin: albums,
      options: {
        service: albumsService,
        storageService,
        validator: AlbumsValidator,
      },
    },
    {
      plugin: songs,
      options: {
        service: songsService,
        validator: SongsValidator,
      },
    },
    {
      plugin: users,
      options: {
        service: usersService,
        validator: UsersValidator,
      },
    },
    {
      plugin: authentications,
      options: {
        authenticationsService,
        usersService,
        tokenManager: TokenManager,
        validator: AuthenticationsValidator,
      },
    },
    {
      plugin: collaborations,
      options: {
        collaborationsService,
        playlistsService,
        validator: CollaborationsValidator,
      },
    },
    {
      plugin: playlists,
      options: {
        collaborationsService,
        service: playlistsService,
        validator: PlaylistsValidator,
      },
    },
    {
      plugin: _exports,
      options: {
        service: ProducerService,
        playlistsService,
        validator: ExportsValidator,
      },
    },
  ]);

  await server.start();
  console.log(`Server berjalan pada ${server.info.uri}`);
};

init();
