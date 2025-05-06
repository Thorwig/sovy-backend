"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.geocodeAddress = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
async function geocodeAddress(address, city, postalCode) {
    const query = encodeURIComponent(`${address}, ${postalCode} ${city}, France`);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1&country=france`;
    try {
        const response = await (0, node_fetch_1.default)(url, {
            headers: {
                'User-Agent': 'FoodSaver/1.0',
                'Accept': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`Geocoding service failed with status: ${response.status}`);
        }
        const data = await response.json();
        if (!data || data.length === 0) {
            throw new Error('Address not found. Please verify your address information.');
        }
        return {
            lat: parseFloat(data[0].lat),
            lon: parseFloat(data[0].lon)
        };
    }
    catch (error) {
        console.error('Geocoding error:', error);
        if (error instanceof Error) {
            throw new Error(`Failed to geocode address: ${error.message}`);
        }
        throw new Error('Failed to geocode address');
    }
}
exports.geocodeAddress = geocodeAddress;
//# sourceMappingURL=geocoding.service.js.map