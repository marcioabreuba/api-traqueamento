const { geoipService } = require('../services');

describe('GeoIP Service', () => {
  beforeAll(async () => {
    await geoipService.initialize();
  });

  describe('IP Validation', () => {
    it('should validate IPv4 addresses correctly', () => {
      const validIPv4s = [
        '192.168.1.1',
        '10.0.0.0',
        '172.16.0.0',
        '8.8.8.8',
        '255.255.255.255'
      ];

      const invalidIPv4s = [
        '256.256.256.256',
        '192.168.001.1',
        '192.168.1',
        '192.168.1.1.1'
      ];

      validIPv4s.forEach(ip => {
        expect(geoipService.isValidIp(ip)).toBe(true);
      });

      invalidIPv4s.forEach(ip => {
        expect(geoipService.isValidIp(ip)).toBe(false);
      });
    });

    it('should validate IPv6 addresses correctly', () => {
      const validIPv6s = [
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
        'fe80::1ff:fe23:4567:890a',
        '2001:db8::2:1',
        '2001:db8:0:1:1:1:1:1'
      ];

      const invalidIPv6s = [
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334:extra',
        '2001:0db8:85a3:0000:0000:8a2e:0370',
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334:'
      ];

      validIPv6s.forEach(ip => {
        expect(geoipService.isValidIp(ip)).toBe(true);
      });

      invalidIPv6s.forEach(ip => {
        expect(geoipService.isValidIp(ip)).toBe(false);
      });
    });

    it('should handle IPv4-mapped IPv6 addresses', () => {
      const validMappedIPs = [
        '::ffff:192.168.1.1',
        '::ffff:10.0.0.0',
        '::ffff:172.16.0.0'
      ];

      validMappedIPs.forEach(ip => {
        expect(geoipService.isValidIp(ip)).toBe(true);
      });
    });
  });

  describe('IP Extraction', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const req = {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.0'
        }
      };

      const ip = geoipService.extractClientIp(req);
      expect(ip).toBe('192.168.1.1');
    });

    it('should extract IP from x-real-ip header', () => {
      const req = {
        headers: {
          'x-real-ip': '10.0.0.0'
        }
      };

      const ip = geoipService.extractClientIp(req);
      expect(ip).toBe('10.0.0.0');
    });

    it('should extract IP from socket', () => {
      const req = {
        headers: {},
        socket: {
          remoteAddress: '172.16.0.0'
        }
      };

      const ip = geoipService.extractClientIp(req);
      expect(ip).toBe('172.16.0.0');
    });

    it('should extract IP from request body', () => {
      const req = {
        headers: {},
        body: {
          user_data: {
            ip: '8.8.8.8'
          }
        }
      };

      const ip = geoipService.extractClientIp(req);
      expect(ip).toBe('8.8.8.8');
    });

    it('should extract IP from query string', () => {
      const req = {
        headers: {},
        query: {
          ip: '1.1.1.1'
        }
      };

      const ip = geoipService.extractClientIp(req);
      expect(ip).toBe('1.1.1.1');
    });

    it('should extract IP from origin header', () => {
      const req = {
        headers: {
          origin: 'http://192.168.1.1'
        }
      };

      const ip = geoipService.extractClientIp(req);
      expect(ip).toBe('192.168.1.1');
    });

    it('should handle multiple IPs in headers', () => {
      const req = {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.0, 172.16.0.0'
        }
      };

      const ip = geoipService.extractClientIp(req);
      expect(ip).toBe('192.168.1.1');
    });

    it('should return null for invalid IPs', () => {
      const req = {
        headers: {
          'x-forwarded-for': 'invalid.ip'
        }
      };

      const ip = geoipService.extractClientIp(req);
      expect(ip).toBeNull();
    });
  });

  describe('GeoIP Lookup', () => {
    it('should return location data for valid IP', async () => {
      const ip = '8.8.8.8';
      const location = await geoipService.getLocation(ip);
      
      expect(location).toBeDefined();
      expect(location).toHaveProperty('country');
      expect(location).toHaveProperty('city');
      expect(location).toHaveProperty('latitude');
      expect(location).toHaveProperty('longitude');
    });

    it('should return null for invalid IP', async () => {
      const ip = 'invalid.ip';
      const location = await geoipService.getLocation(ip);
      expect(location).toBeNull();
    });

    it('should handle IPv6 lookup', async () => {
      const ip = '2001:db8::1';
      const location = await geoipService.getLocation(ip);
      expect(location).toBeDefined();
    });
  });
}); 