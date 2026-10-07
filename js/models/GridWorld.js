/**
 * GridWorld: Modelo del Entorno del Mundo de Wumpus
 * 
 * Gestiona el tamaño del tablero, la ubicación real del Wumpus, hoyos, oro,
 * y genera las percepciones que el agente experimenta en cada casilla.
 * Coordenadas estándar: (x, y) con 1 <= x <= width y 1 <= y <= height.
 * (1, 1) se ubica en la esquina inferior izquierda (Convención Russell & Norvig).
 */

import { Perception } from '../logic/Perception.js';

export class GridWorld {
    constructor(width = 4, height = 4) {
        this.width = width;
        this.height = height;
        
        // Elementos reales en el mundo
        this.wumpusPos = null;       // { x, y }
        this.wumpusAlive = true;
        this.goldPos = null;         // { x, y }
        this.goldCollected = false;
        this.pits = new Set();       // Set de strings "x,y"
        this.startPos = { x: 1, y: 1 };
        
        this.wumpusScreamHeard = false;
    }

    /**
     * Clave única para coordenadas
     */
    static key(x, y) {
        return `${x},${y}`;
    }

    static parseKey(key) {
        const [x, y] = key.split(',').map(Number);
        return { x, y };
    }

    /**
     * Verifica si una coordenada está dentro del tablero
     */
    isValid(x, y) {
        return x >= 1 && x <= this.width && y >= 1 && y <= this.height;
    }

    /**
     * Obtiene los vecinos ortogonales válidos (Arriba, Abajo, Izquierda, Derecha)
     */
    getAdjacent(x, y) {
        const neighbors = [
            { x: x, y: y + 1, dir: 'ARRIBA' },
            { x: x + 1, y: y, dir: 'DERECHA' },
            { x: x, y: y - 1, dir: 'ABAJO' },
            { x: x - 1, y: y, dir: 'IZQUIERDA' }
        ];
        return neighbors.filter(pos => this.isValid(pos.x, pos.y));
    }

    /**
     * Calcula las percepciones exactas del agente en la posición (x,y)
     */
    getPerception(x, y, bump = false) {
        if (!this.isValid(x, y)) {
            return new Perception({ bump: true });
        }

        const neighbors = this.getAdjacent(x, y);

        // Brisa: si hay hoyo en algún vecino
        const breeze = neighbors.some(n => this.pits.has(GridWorld.key(n.x, n.y)));

        // Hedor: si el Wumpus está vivo y en algún vecino
        const stench = this.wumpusAlive && this.wumpusPos && neighbors.some(
            n => n.x === this.wumpusPos.x && n.y === this.wumpusPos.y
        );

        // Brillo: si el oro está en esta casilla y no ha sido recogido
        const glitter = !this.goldCollected && this.goldPos && (this.goldPos.x === x && this.goldPos.y === y);

        // Grito: si el Wumpus acaba de morir
        const scream = this.wumpusScreamHeard;
        if (this.wumpusScreamHeard) {
            this.wumpusScreamHeard = false; // Solo se percibe inmediatamente tras el disparo
        }

        return new Perception({
            stench: Boolean(stench),
            breeze: Boolean(breeze),
            glitter: Boolean(glitter),
            bump: Boolean(bump),
            scream: Boolean(scream)
        });
    }

    /**
     * Disparo de flecha desde (fromX, fromY) en una dirección dada
     */
    shootArrow(fromX, fromY, direction) {
        const deltas = {
            'ARRIBA': { dx: 0, dy: 1 },
            'DERECHA': { dx: 1, dy: 0 },
            'ABAJO': { dx: 0, dy: -1 },
            'IZQUIERDA': { dx: -1, dy: 0 }
        };

        const delta = deltas[direction];
        if (!delta) return false;

        let curX = fromX + delta.dx;
        let curY = fromY + delta.dy;

        while (this.isValid(curX, curY)) {
            if (this.wumpusAlive && this.wumpusPos && this.wumpusPos.x === curX && this.wumpusPos.y === curY) {
                this.wumpusAlive = false;
                this.wumpusScreamHeard = true;
                return true; // Wumpus eliminado
            }
            curX += delta.dx;
            curY += delta.dy;
        }

        return false; // Falló el disparo
    }

    /**
     * Cargar mapa predefinido: Clásico de Russell & Norvig
     * 4x4:
     * Wumpus en (1,3)
     * Oro en (2,3)
     * Hoyos en (3,1), (3,3), (4,4)
     * Inicio (1,1)
     */
    loadPresetClassic() {
        this.width = 4;
        this.height = 4;
        this.wumpusPos = { x: 1, y: 3 };
        this.wumpusAlive = true;
        this.goldPos = { x: 2, y: 3 };
        this.goldCollected = false;
        this.pits = new Set([
            GridWorld.key(3, 1),
            GridWorld.key(3, 3),
            GridWorld.key(4, 4)
        ]);
        this.startPos = { x: 1, y: 1 };
        this.wumpusScreamHeard = false;
    }

    /**
     * Cargar mapa predefinido: Intersección Lógica de Hedor
     * Permite deducir exactamente la posición del Wumpus mediante dos casillas con hedor
     */
    loadPresetStenchIntersection() {
        this.width = 4;
        this.height = 4;
        this.wumpusPos = { x: 2, y: 2 };
        this.wumpusAlive = true;
        this.goldPos = { x: 4, y: 1 };
        this.goldCollected = false;
        this.pits = new Set([
            GridWorld.key(3, 3),
            GridWorld.key(1, 4)
        ]);
        this.startPos = { x: 1, y: 1 };
        this.wumpusScreamHeard = false;
    }

    /**
     * Cargar mapa predefinido: Ruta segura con hoyos perimetrales
     */
    loadPresetSafeCorridor() {
        this.width = 4;
        this.height = 4;
        this.wumpusPos = { x: 4, y: 3 };
        this.wumpusAlive = true;
        this.goldPos = { x: 3, y: 4 };
        this.goldCollected = false;
        this.pits = new Set([
            GridWorld.key(2, 1),
            GridWorld.key(2, 3),
            GridWorld.key(4, 1)
        ]);
        this.startPos = { x: 1, y: 1 };
        this.wumpusScreamHeard = false;
    }

    /**
     * Genera un tablero aleatorio con garantía de inicio seguro (1,1) y adyacentes controlados
     */
    generateRandom(pitProbability = 0.2) {
        this.width = 4;
        this.height = 4;
        this.wumpusAlive = true;
        this.goldCollected = false;
        this.pits = new Set();
        this.wumpusScreamHeard = false;

        const allCells = [];
        for (let x = 1; x <= this.width; x++) {
            for (let y = 1; y <= this.height; y++) {
                if (x === 1 && y === 1) continue; // Inicio libre de peligro
                allCells.push({ x, y });
            }
        }

        // Barajar casillas
        const shuffled = [...allCells].sort(() => Math.random() - 0.5);

        // Colocar Wumpus
        this.wumpusPos = shuffled.pop();

        // Colocar Oro
        this.goldPos = shuffled.pop();

        // Colocar hoyos con probabilidad
        for (const cell of shuffled) {
            // Evitar hoyo en adyacentes inmediatos si se bloquea todo el inicio
            if (Math.random() < pitProbability) {
                this.pits.add(GridWorld.key(cell.x, cell.y));
            }
        }

        // Asegurar que al menos una casilla adyacente a (1,1) esté libre de hoyo
        const adjToStart = [{ x: 1, y: 2 }, { x: 2, y: 1 }];
        const allBlocked = adjToStart.every(pos => 
            this.pits.has(GridWorld.key(pos.x, pos.y)) || 
            (this.wumpusPos.x === pos.x && this.wumpusPos.y === pos.y)
        );
        if (allBlocked) {
            // Liberar (1,2)
            this.pits.delete(GridWorld.key(1, 2));
            if (this.wumpusPos.x === 1 && this.wumpusPos.y === 2) {
                this.wumpusPos = { x: 3, y: 3 };
            }
        }
    }
}
