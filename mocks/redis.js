// __mocks__/redis.js
module.exports.createClient = jest.fn(() => {
  return {
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(),
    set: jest.fn(),
    get: jest.fn(),
    quit: jest.fn(),
  };
});