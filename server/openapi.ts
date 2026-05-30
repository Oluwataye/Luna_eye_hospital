// ── Zod Type to OpenAPI JSON Schema Converter ──
export const zodToOpenAPI = (schema: any): any => {
  if (!schema || !schema._def) return {};

  let current = schema;
  const wrappers = ['ZodEffects', 'ZodOptional', 'ZodNullable', 'ZodDefault'];
  
  // Unpack schema wrappers recursively
  while (current._def && wrappers.includes(current._def.typeName)) {
    const typeName = current._def.typeName;
    if (typeName === 'ZodEffects') {
      current = current._def.schema;
    } else if (typeName === 'ZodOptional' || typeName === 'ZodNullable') {
      current = current.unwrap();
    } else if (typeName === 'ZodDefault') {
      current = current._def.innerType;
    }
  }

  const typeName = current._def ? current._def.typeName : '';

  if (typeName === 'ZodString') {
    return { type: 'string' };
  }
  if (typeName === 'ZodNumber') {
    return { type: 'number' };
  }
  if (typeName === 'ZodBoolean') {
    return { type: 'boolean' };
  }
  if (typeName === 'ZodEnum') {
    return { type: 'string', enum: current._def.values };
  }
  if (typeName === 'ZodArray') {
    return { type: 'array', items: zodToOpenAPI(current.element) };
  }
  if (typeName === 'ZodObject') {
    const properties: any = {};
    const required: string[] = [];
    const shape = current.shape;

    for (const key in shape) {
      properties[key] = zodToOpenAPI(shape[key]);
      
      let isOptional = false;
      let inner = shape[key];
      while (inner && inner._def && wrappers.includes(inner._def.typeName)) {
        const innerType = inner._def.typeName;
        if (innerType === 'ZodOptional') {
          isOptional = true;
          inner = inner.unwrap();
        } else if (innerType === 'ZodEffects') {
          inner = inner._def.schema;
        } else if (innerType === 'ZodNullable') {
          inner = inner.unwrap();
        } else if (innerType === 'ZodDefault') {
          inner = inner._def.innerType;
        }
      }
      if (!isOptional) {
        required.push(key);
      }
    }

    const objSchema: any = { type: 'object', properties };
    if (required.length > 0) {
      objSchema.required = required;
    }
    return objSchema;
  }

  return { type: 'string' }; // fallback
};

// ── Convert Zod object fields into OpenAPI Query parameters ──
const mapQueryParameters = (schema: any): any[] => {
  const params: any[] = [];
  if (!schema || !schema.shape) return params;
  const shape = schema.shape;
  const wrappers = ['ZodEffects', 'ZodOptional', 'ZodNullable', 'ZodDefault'];
  
  for (const key in shape) {
    let isOptional = false;
    let inner = shape[key];
    while (inner && inner._def && wrappers.includes(inner._def.typeName)) {
      const innerType = inner._def.typeName;
      if (innerType === 'ZodOptional') {
        isOptional = true;
        inner = inner.unwrap();
      } else if (innerType === 'ZodEffects') {
        inner = inner._def.schema;
      } else if (innerType === 'ZodNullable') {
        inner = inner.unwrap();
      } else if (innerType === 'ZodDefault') {
        inner = inner._def.innerType;
      }
    }

    params.push({
      name: key,
      in: 'query',
      required: !isOptional,
      schema: zodToOpenAPI(shape[key])
    });
  }
  return params;
};

// Import our schemas for OpenAPI representation
import { 
  LoginSchema, CreateUserSchema, UpdateUserSchema, ChangePasswordSchema, 
  CreatePatientSchema, AuditLogQuerySchema, PatientListQuerySchema, 
  ReprintQuerySchema, RequiredReportQuerySchema 
} from './validation';

// ── OpenAPI document builder ──
export const getOpenAPIDoc = () => {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Luna Eye Hospital EMR API Documentation',
      version: '1.0.0',
      description: 'Auto-generated OpenAPI Documentation generated directly from runtime Zod validation schemas. Designed to ensure API definitions and application schemas remain synchronized.'
    },
    servers: [
      { url: 'http://localhost:3200', description: 'Development Server' }
    ],
    paths: {
      '/api/login': {
        post: {
          summary: 'User Login',
          description: 'Authenticate user credentials and set a secure HttpOnly session cookie.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: zodToOpenAPI(LoginSchema)
              }
            }
          },
          responses: {
            200: { description: 'Successful login session' },
            400: { description: 'Validation failed' },
            401: { description: 'Invalid username or password' }
          }
        }
      },
      '/api/users': {
        get: {
          summary: 'List Users',
          description: 'Get all user accounts (Admin role required).',
          responses: {
            200: { description: 'Successful query response' },
            401: { description: 'Session unauthorized' }
          }
        },
        post: {
          summary: 'Create User Account',
          description: 'Register a new staff account (Admin role required). Enforces password policy.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: zodToOpenAPI(CreateUserSchema)
              }
            }
          },
          responses: {
            201: { description: 'Account registered successfully' },
            400: { description: 'Validation failure' },
            409: { description: 'Username already exists' }
          }
        }
      },
      '/api/users/{id}': {
        put: {
          summary: 'Update User Profile',
          description: 'Modify staff metadata, role, status, or reset password (Admin role required).',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: zodToOpenAPI(UpdateUserSchema)
              }
            }
          },
          responses: {
            200: { description: 'Successfully updated profile' }
          }
        }
      },
      '/api/change-password': {
        post: {
          summary: 'Change Password',
          description: 'Allows users to update their password. Enforces password policy.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: zodToOpenAPI(ChangePasswordSchema)
              }
            }
          },
          responses: {
            200: { description: 'Password successfully changed' },
            401: { description: 'Incorrect current password' }
          }
        }
      },
      '/api/patients': {
        get: {
          summary: 'List Patients',
          description: 'Queries registered patients with pagination limit, offset, and query search.',
          parameters: mapQueryParameters(PatientListQuerySchema),
          responses: {
            200: { description: 'Successful response' }
          }
        },
        post: {
          summary: 'Register Patient',
          description: 'Create a patient record and check-in to today\'s registration visit queue (Receptionist/Admin only).',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: zodToOpenAPI(CreatePatientSchema)
              }
            }
          },
          responses: {
            201: { description: 'Patient registered successfully' },
            409: { description: 'Duplicate patient detected' }
          }
        }
      },
      '/api/audit-logs': {
        get: {
          summary: 'Fetch Audit Logs',
          description: 'Queries backend transaction records with pagination, user, and action filters (Admin only).',
          parameters: mapQueryParameters(AuditLogQuerySchema),
          responses: {
            200: { description: 'Successful response' }
          }
        }
      },
      '/api/reprints': {
        get: {
          summary: 'Fetch Receipt Reprint Logs',
          description: 'Queries receipt reprints with pagination and filters (Admin only).',
          parameters: mapQueryParameters(ReprintQuerySchema),
          responses: {
            200: { description: 'Successful response' }
          }
        }
      },
      '/api/reports/sales': {
        get: {
          summary: 'GET Sales Report',
          description: 'Fetches sales transaction history inside a date range (Admin only).',
          parameters: mapQueryParameters(RequiredReportQuerySchema),
          responses: {
            200: { description: 'Successful response' }
          }
        }
      },
      '/api/reports/expenses': {
        get: {
          summary: 'GET Expenses Report',
          description: 'Fetches expenses records inside a date range (Admin only).',
          parameters: mapQueryParameters(RequiredReportQuerySchema),
          responses: {
            200: { description: 'Successful response' }
          }
        }
      }
    }
  };
};

// ── Register Swagger UI Routes ──
export const registerSwaggerDocs = (app: any) => {
  app.get('/api-docs/json', (req: any, res: any) => {
    res.json(getOpenAPIDoc());
  });

  app.get('/api-docs', (req: any, res: any) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Luna Eye Hospital EMR - API Documentation</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui.min.css" />
    <style>
      html { box-sizing: border-box; overflow: -grow-y; }
      *, *:before, *:after { box-sizing: inherit; }
      body { margin: 0; background: #fafafa; }
      .swagger-ui .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-bundle.js" charset="UTF-8"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: '/api-docs/json',
          dom_id: '#swagger-ui',
          presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIStandalonePreset
          ],
          layout: "BaseLayout",
          deepLinking: true,
          showExtensions: true,
          showCommonExtensions: true
        });
      };
    </script>
  </body>
</html>
    `;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });
};
