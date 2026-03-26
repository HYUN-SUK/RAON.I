import proj4_pkg from 'proj4';
import * as proj4_star from 'proj4';

console.log('--- PROJ4 IMPORT TEST ---');
console.log('default import:', typeof proj4_pkg);
if (typeof proj4_pkg === 'object') {
    console.log('default import keys:', Object.keys(proj4_pkg));
}
console.log('star import:', typeof proj4_star);
console.log('star import keys:', Object.keys(proj4_star));
