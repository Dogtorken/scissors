const request = require('supertest');
const app = require('../../app');
const ShortUrl = require('../models/ShortUrl');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');

jest.mock('../models/ShortUrl');
jest.mock('../middleware/authMiddleware', () => ({
  requireAuth: (req, res, next) => {
    res.locals.user = { _id: 'mockedUserId' };
    next();
  },
  checkUser: (req, res, next) => {
    res.locals.user = { _id: 'mockedUserId' };
    next();
  }
}));
jest.mock('jsonwebtoken');
jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('mock-qr-code-data-url')
}));

describe('Shorten Routes', () => {
  let token;
  let userId;

  beforeAll(() => {
    userId = 'mockedUserId';
    token = jwt.sign({ id: userId }, 'your_jwt_secret');
  });

  describe('GET /shorten', () => {
    it('should retrieve short URLs', async () => {
      const mockShortUrls = [
        { full: 'https://example.com', short: 'abc123', clicks: 0 },
        { full: 'https://test.com', short: 'def456', clicks: 5 }
      ];
      ShortUrl.find.mockResolvedValue(mockShortUrls);

      const response = await request(app)
        .get('/shorten')
        .set('Cookie', `jwt=${token}`);

      expect(response.status).toBe(200);
      expect(response.text).toContain('abc123');
      expect(response.text).toContain('def456');
    });

    it('should handle database errors', async () => {
      ShortUrl.find.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/shorten')
        .set('Cookie', `jwt=${token}`);

      expect(response.status).toBe(500);
      expect(response.text).toContain('Error');
      expect(response.headers['content-type']).toContain('text/html');
    });
  });

  describe('POST /shorten', () => {
    it('should create a new short URL', async () => {
      const mockShortUrl = {
        full: 'https://example.com',
        short: 'abc123',
        save: jest.fn(),
      };
      ShortUrl.findOne.mockResolvedValue(null);
      ShortUrl.mockImplementation(() => mockShortUrl);

      const response = await request(app)
        .post('/shorten')
        .send({ fullUrl: 'https://example.com' })
        .set('Cookie', `jwt=${token}`);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('shortUrl');
      expect(mockShortUrl.save).toHaveBeenCalled();
      expect(QRCode.toDataURL).toHaveBeenCalled();
    });

    it('should return existing short URL if it already exists', async () => {
      const existingUrl = {
        full: 'https://example.com',
        short: 'abc123',
      };
      ShortUrl.findOne.mockResolvedValue(existingUrl);

      const response = await request(app)
        .post('/shorten')
        .send({ fullUrl: 'https://example.com' })
        .set('Cookie', `jwt=${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('shortUrl');
      expect(response.body).toHaveProperty('alreadyExists', true);
    });

    it('should handle invalid URLs', async () => {
      const response = await request(app)
        .post('/shorten')
        .send({ fullUrl: 'invalid-url' })
        .set('Cookie', `jwt=${token}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid URL');
    });

    it('should handle empty URLs', async () => {
      const response = await request(app)
        .post('/shorten')
        .send({ fullUrl: '' })
        .set('Cookie', `jwt=${token}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid URL');
    });
  });

  describe('GET /:shortUrl', () => {
    it('should redirect to the full URL', async () => {
      const mockShortUrl = { full: 'http://example.com', clicks: 0, save: jest.fn() };
      ShortUrl.findOne.mockResolvedValue(mockShortUrl);

      const response = await request(app).get('/abc123');

      expect(response.status).toBe(302);
      expect(response.header.location).toBe('http://example.com');
      expect(mockShortUrl.clicks).toBe(1);
      expect(mockShortUrl.save).toHaveBeenCalled();
    });

    it('should return 404 for non-existent short URLs', async () => {
      ShortUrl.findOne.mockResolvedValue(null);

      const response = await request(app).get('/nonexistent');

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /shorten/:id', () => {
    it('should delete a short URL', async () => {
      const mockShortUrl = { _id: 'abc123', user: userId };
      ShortUrl.findOne.mockResolvedValue(mockShortUrl);
      ShortUrl.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const response = await request(app)
        .delete('/shorten/abc123')
        .set('Cookie', `jwt=${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Short URL deleted successfully' });
      expect(ShortUrl.findOne).toHaveBeenCalledWith({ _id: 'abc123', user: userId });
      expect(ShortUrl.deleteOne).toHaveBeenCalledWith({ _id: 'abc123' });
    });

    it('should return 404 if short URL not found', async () => {
      ShortUrl.findOne.mockResolvedValue(null);

      const response = await request(app)
        .delete('/shorten/nonexistent')
        .set('Cookie', `jwt=${token}`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: 'Short URL not found' });
    });
  });
});