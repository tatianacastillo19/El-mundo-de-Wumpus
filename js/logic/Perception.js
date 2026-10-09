/**
 * Percepción del Agente en el Mundo de Wumpus
 * 
 * En cada casilla en la que entra el agente, el entorno genera un conjunto de percepciones:
 * - stench (Hedor): Indica que el Wumpus está en una casilla adyacente (ortogonal).
 * - breeze (Brisa): Indica que hay un Hoyo en una casilla adyacente (ortogonal).
 * - glitter (Brillo): Indica que el Oro está en la casilla actual.
 * - bump (Golpe): Indica que el agente intentó moverse contra una pared.
 * - scream (Grito): Indica que el Wumpus ha muerto por una flecha en algún lugar del mundo.
 */
export class Perception {
    constructor({ stench = false, breeze = false, glitter = false, bump = false, scream = false } = {}) {
        this.stench = stench;
        this.breeze = breeze;
        this.glitter = glitter;
        this.bump = bump;
        this.scream = scream;
    }

    toVector() {
        return [this.stench, this.breeze, this.glitter, this.bump, this.scream]
            .map(percept => percept ? 1 : 0);
    }

    /**
     * Devuelve una representación legible de las percepciones activas.
     */
    toTextArray() {
        const list = [];
        if (this.glitter) list.push({ key: 'glitter', label: 'BRILLO', desc: 'Hay oro en esta casilla.' });
        if (this.breeze) list.push({ key: 'breeze', label: 'BRISA', desc: 'Hay un hoyo en una casilla adyacente.' });
        if (this.stench) list.push({ key: 'stench', label: 'HEDOR', desc: 'El Wumpus está en una casilla adyacente.' });
        if (this.bump) list.push({ key: 'bump', label: 'GOLPE', desc: 'Has chocado contra un muro.' });
        if (this.scream) list.push({ key: 'scream', label: 'GRITO', desc: '¡El Wumpus ha muerto!' });
        
        if (list.length === 0) {
            list.push({ key: 'none', label: 'LIMPIO', desc: 'No se percibe brisa ni hedor.' });
        }
        return list;
    }

    toString() {
        const parts = [];
        if (this.breeze) parts.push('Brisa');
        if (this.stench) parts.push('Hedor');
        if (this.glitter) parts.push('Brillo');
        if (this.bump) parts.push('Golpe');
        if (this.scream) parts.push('Grito');
        return parts.length > 0 ? parts.join(', ') : 'Ninguna (Limpio)';
    }
}
