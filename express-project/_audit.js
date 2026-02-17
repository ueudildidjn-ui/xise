/**
 * Full API documentation audit script
 * Compares routes defined in app.js with what's in the swagger spec
 * Also checks for completeness of parameters
 */
process.env.DATABASE_URL = "mysql://root@localhost:3306/test";

const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const { parseRouteFile, ROUTE_FILE_MAP } = require('./utils/swaggerAutoGen');

// Load the swagger spec
const swaggerSpec = require('./config/swagger');

// 1. Find ALL routes from route files using the auto-scanner
console.log('=== PHASE 1: Route files scan ===\n');
const allFileRoutes = [];
for (const [fileName, basePath] of Object.entries(ROUTE_FILE_MAP)) {
  const filePath = path.join(routesDir, fileName);
  if (fs.existsSync(filePath)) {
    const routes = parseRouteFile(filePath, basePath);
    allFileRoutes.push(...routes);
    console.log(`  ${fileName}: ${routes.length} routes`);
  }
}
console.log(`  Total from route files: ${allFileRoutes.length}\n`);

// 2. Check app.js for non-route-file endpoints
console.log('=== PHASE 2: app.js endpoints ===\n');
const appSource = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const appRouteRegex = /app\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g;
const appRoutes = [];
let match;
while ((match = appRouteRegex.exec(appSource)) !== null) {
  const method = match[1];
  const routePath = match[2];
  // Skip swagger-ui and static paths
  if (routePath.includes('api-docs') || routePath === '/uploads') continue;
  appRoutes.push({ method, path: routePath });
  console.log(`  app.${method}('${routePath}')`);
}
console.log(`  Total app.js routes: ${appRoutes.length}\n`);

// 3. Check swagger spec coverage
console.log('=== PHASE 3: Swagger spec coverage ===\n');
const specPaths = swaggerSpec.paths || {};
const specEndpoints = new Set();
for (const [path, methods] of Object.entries(specPaths)) {
  for (const method of Object.keys(methods)) {
    if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
      specEndpoints.add(`${method.toUpperCase()} ${path}`);
    }
  }
}
console.log(`  Total swagger endpoints: ${specEndpoints.size}\n`);

// 4. Find MISSING routes
console.log('=== PHASE 4: Missing from swagger ===\n');
let missingCount = 0;

// Check route file routes
for (const route of allFileRoutes) {
  const key = `${route.method.toUpperCase()} ${route.path}`;
  if (!specEndpoints.has(key)) {
    console.log(`  MISSING: ${key} (from route files)`);
    missingCount++;
  }
}

// Check app.js routes
for (const route of appRoutes) {
  const swaggerPath = route.path.replace(/:(\w+)/g, '{$1}');
  const key = `${route.method.toUpperCase()} ${swaggerPath}`;
  if (!specEndpoints.has(key)) {
    console.log(`  MISSING: ${key} (from app.js)`);
    missingCount++;
  }
}

if (missingCount === 0) {
  console.log('  ✅ No missing routes!\n');
} else {
  console.log(`\n  ⚠️ ${missingCount} routes missing from swagger!\n`);
}

// 5. Check for extra routes in swagger (documenting non-existent routes)
console.log('=== PHASE 5: Extra routes in swagger (not in code) ===\n');
const codeEndpoints = new Set();
for (const route of allFileRoutes) {
  codeEndpoints.add(`${route.method.toUpperCase()} ${route.path}`);
}
for (const route of appRoutes) {
  const swaggerPath = route.path.replace(/:(\w+)/g, '{$1}');
  codeEndpoints.add(`${route.method.toUpperCase()} ${swaggerPath}`);
}

let extraCount = 0;
for (const endpoint of specEndpoints) {
  if (!codeEndpoints.has(endpoint)) {
    console.log(`  EXTRA: ${endpoint} (in swagger but not in code)`);
    extraCount++;
  }
}
if (extraCount === 0) {
  console.log('  ✅ No extra routes!\n');
} else {
  console.log(`\n  ⚠️ ${extraCount} extra routes in swagger!\n`);
}

// 6. Parameter completeness check
console.log('=== PHASE 6: Parameter completeness ===\n');
let paramIssues = 0;
for (const route of allFileRoutes) {
  const specPath = specPaths[route.path];
  if (!specPath || !specPath[route.method]) continue;
  
  const spec = specPath[route.method];
  const specParams = (spec.parameters || []);
  
  // Check path params
  for (const param of route.pathParams) {
    const found = specParams.some(p => p.in === 'path' && p.name === param);
    if (!found) {
      console.log(`  ${route.method.toUpperCase()} ${route.path}: missing path param '${param}'`);
      paramIssues++;
    }
  }
  
  // Check query params
  for (const [name] of Object.entries(route.queryParams)) {
    const found = specParams.some(p => p.in === 'query' && p.name === name);
    if (!found) {
      console.log(`  ${route.method.toUpperCase()} ${route.path}: missing query param '${name}'`);
      paramIssues++;
    }
  }
  
  // Check body params
  if (Object.keys(route.bodyParams).length > 0 && ['post', 'put', 'patch', 'delete'].includes(route.method)) {
    const hasBody = !!spec.requestBody;
    if (!hasBody) {
      console.log(`  ${route.method.toUpperCase()} ${route.path}: missing requestBody (needs: ${Object.keys(route.bodyParams).join(', ')})`);
      paramIssues++;
    } else {
      const bodySchema = spec.requestBody?.content?.['application/json']?.schema;
      const bodyProps = bodySchema?.properties || {};
      for (const [name] of Object.entries(route.bodyParams)) {
        if (!bodyProps[name]) {
          // Also check multipart
          const multipartSchema = spec.requestBody?.content?.['multipart/form-data']?.schema;
          const multipartProps = multipartSchema?.properties || {};
          if (!multipartProps[name]) {
            console.log(`  ${route.method.toUpperCase()} ${route.path}: missing body param '${name}'`);
            paramIssues++;
          }
        }
      }
    }
  }
}

if (paramIssues === 0) {
  console.log('  ✅ All parameters are documented!\n');
} else {
  console.log(`\n  ⚠️ ${paramIssues} parameter issues found!\n`);
}

// Summary
console.log('=== SUMMARY ===');
console.log(`Route files: ${allFileRoutes.length} routes`);
console.log(`App.js: ${appRoutes.length} routes`);
console.log(`Swagger: ${specEndpoints.size} endpoints`);
console.log(`Missing routes: ${missingCount}`);
console.log(`Extra routes: ${extraCount}`);
console.log(`Parameter issues: ${paramIssues}`);
