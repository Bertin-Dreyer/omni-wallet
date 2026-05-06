import swaggerJsdoc from 'swagger-jsdoc';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import glob from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Omni Wallet API',
      version: '1.0.0',
      description: 'API documentation for the Omni Wallet service',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'User ID'
            },
            name: {
              type: 'string',
              description: 'User name'
            },
            email: {
              type: 'string',
              description: 'User email'
            },
            status: {
              type: 'string',
              description: 'User status'
            }
          }
        },
        UserRegistration: {
          type: 'object',
          required: [
            'name',
            'email',
            'password'
          ],
          properties: {
            name: {
              type: 'string',
              example: 'John Doe'
            },
            email: {
              type: 'string',
              example: 'user@example.com'
            },
            password: {
              type: 'string',
              example: 'password123'
            }
          }
        },
        UserLogin: {
          type: 'object',
          required: [
            'email',
            'password'
          ],
          properties: {
            email: {
              type: 'string',
              example: 'user@example.com'
            },
            password: {
              type: 'string',
              example: 'password123'
            }
          }
        },
        UserRegistrationResponse: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer'
                },
                name: {
                  type: 'string'
                },
                email: {
                  type: 'string'
                },
                status: {
                  type: 'string'
                }
              }
            },
            accessToken: {
              type: 'string'
            },
            refreshToken: {
              type: 'string'
            }
          }
        },
        UserLoginResponse: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer'
                },
                name: {
                  type: 'string'
                },
                email: {
                  type: 'string'
                }
              }
            },
            accessToken: {
              type: 'string'
            },
            refreshToken: {
              type: 'string'
            }
          }
        },
        Account: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Account ID'
            },
            account_number: {
              type: 'string',
              description: 'Account number'
            },
            currency: {
              type: 'string',
              description: 'Account currency'
            },
            status: {
              type: 'string',
              description: 'Account status'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp'
            }
          }
        },
        Transaction: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Transaction ID'
            },
            reference: {
              type: 'string',
              description: 'Transaction reference'
            },
            type: {
              type: 'string',
              description: 'Transaction type'
            },
            status: {
              type: 'string',
              description: 'Transaction status'
            },
            amount_cents: {
              type: 'integer',
              description: 'Transaction amount in cents'
            },
            currency: {
              type: 'string',
              description: 'Transaction currency'
            },
            description: {
              type: 'string',
              description: 'Transaction description'
            },
            processed_at: {
              type: 'string',
              format: 'date-time',
              description: 'Transaction processed at'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Transaction creation timestamp'
            }
          }
        }
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    responses: {
      '200': {
        description: 'OK'
      },
      '400': {
        description: 'Bad Request'
      },
      '401': {
        description: 'Unauthorized'
      },
      '404': {
        description: 'Not Found'
      },
      '409': {
        description: 'Conflict'
      },
      '500': {
        description: 'Internal Server Error'
      }
    }
  },
  apis: ['src/routes/*.js', 'src/app.js']
};

const specs = swaggerJsdoc(options);
export default specs;