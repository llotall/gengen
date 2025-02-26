import { EndpointNameResolver } from '../../src/services/EndpointNameResolver';
import { EndpointsService } from '../../src/services/EndpointsService';
import { OpenAPIService } from '../../src/swagger/OpenAPIService';
import { OpenAPITypesGuard } from '../../src/swagger/OpenAPITypesGuard';

describe('EndpointsService tests', () => {
    function getService(spec: string): EndpointsService {
        const openApiService = new OpenAPIService(spec, new OpenAPITypesGuard());
        return new EndpointsService(openApiService, new EndpointNameResolver());
    }

    describe('getActionsGroupedByController', () => {
        test('group actions', () => {
            // Arrange
            const spec = {
                openapi: '3.0.1',
                paths: {
                    '/Product/SearchProducts': {
                        get: { tags: ['Product'] }
                    },
                    '/api/v1/Category/AddCategory': {
                        get: { tags: ['Category'] }
                    },
                    '/Product/GetProducts': {
                        get: { tags: ['Product'] }
                    }
                }
            };

            const expected = {
                Category: { addCategory: "/api/v1/Category/AddCategory" },
                Product: {
                    getProducts: "/Product/GetProducts",
                    searchProducts: "/Product/SearchProducts",
                }
            };

            const service = getService(JSON.stringify(spec));

            // Act
            const result = service.getActionsGroupedByController();

            // Assert
            expect(Object.keys(result)).toEqual(['Category', 'Product']);
            expect(result).toEqual(expected);
        });

        test('tags does not exists', () => {
            // Arrange
            const spec = {
                openapi: '3.0.1',
                paths: {
                    '/Product/SearchProducts': {},
                    '/api/v1/Category/AddCategory': {},
                    '/Product/GetProducts': {}
                }
            };

            const service = getService(JSON.stringify(spec));

            // Act
            const result = service.getActionsGroupedByController();

            // Assert
            expect(result).toEqual({});
        });
    });

    describe('getEndpoints', () => {
        test('sort actions', () => {
            // Arrange
            const spec = {
                openapi: '3.0.1',
                paths: {
                    '/Product/SearchProducts': {
                        get: { tags: ['Product'] }
                    },
                    '/api/v1/Category/AddCategory': {
                        get: { tags: ['Category'] }
                    },
                    '/Product/GetProducts': {
                        get: { tags: ['Product'] }
                    },
                    '/api/v1/Product/Product/{id}': {
                        get: { tags: ['Product'] }
                    }
                }
            }
            const expected = new Set(['/Product/GetProducts', '/Product/SearchProducts', '/api/v1/Category/AddCategory', '/api/v1/Product/Product/{id}']);
            const service = getService(JSON.stringify(spec));

            // Act
            const result = service.getEndpoints();

            // Assert
            expect(result).toEqual(expected);
        });
    });

    describe('parse', () => {
        test('short endpoint', () => {
            // Arrange
            const spec = {
                openapi: '3.0.1',
                paths: { '/Product/SearchProducts': { get: { tags: ['Product'] } } }
            };

            const service = getService(JSON.stringify(spec));

            // Act
            const result = service.parse('/Product/SearchProducts')

            // Assert
            expect(result).toMatchObject({
                name: 'Product',
                actions: [{ origin: 'SearchProducts', name: 'searchProducts' }],
                relativePath: '/Product'
            });
        });

        test('version endpoint', () => {
            // Arrange
            const spec = {
                openapi: '3.0.1',
                paths: { '/api/v1/Product/SearchProducts': { get: { tags: ['Product'] } } }
            };
            const service = getService(JSON.stringify(spec));

            // Act
            const result = service.parse('/api/v1/Product/SearchProducts');

            // Assert
            expect(result).toMatchObject({
                name: 'Product',
                actions: [{ origin: 'SearchProducts', name: 'searchProducts' }],
                relativePath: '/api/v1/Product'
            });
        });

        test('long endpoint', () => {
            // Arrange
            const spec = {
                openapi: '3.0.1',
                paths: { '/api/v1/Product/Download/{id}': { get: { tags: ['Product'] } } }
            };

            const service = getService(JSON.stringify(spec));

            // Act
            const result = service.parse('/api/v1/Product/Download/{id}');

            // Assert
            expect(result).toMatchObject({
                name: 'Product',
                actions: [{ origin: 'Download/{id}', name: 'download' }],
                relativePath: '/api/v1/Product'
            });
        });
    });
});
