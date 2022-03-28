const fs = require('fs');
const path = require('path');

class StorageService {
  constructor(directory) {
    this._directory = directory;

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory);
    }
  }

  async writeFile(file) {
    const { filename } = file.hapi;
    const newName = `${new Date().valueOf()}-${filename}`;
    const imagePath = path.join(this._directory, newName);

    const fileStream = fs.createWriteStream(imagePath);

    return new Promise((resolve, reject) => {
      fileStream.on('error', (error) => reject(error));
      file.pipe(fileStream);
      file.on('end', () => resolve(imagePath));
    });
  }
}

module.exports = StorageService;
