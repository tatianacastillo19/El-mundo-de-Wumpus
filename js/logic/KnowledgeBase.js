/**
 * Base de Conocimiento (Knowledge Base - KB) del Agente Lógico
 * 
 * Almacena las proposiciones lógicas, hechos conocidos, percepciones recolectadas
 * y conclusiones deducidas en el Mundo de Wumpus.
 * 
 * Estados de una casilla para Hoyo (P) o Wumpus (W):
 * - UNKNOWN: Aún no hay información suficiente.
 * - NO: Se ha demostrado formalmente que NO contiene la amenaza (¬P o ¬W).
 * - POSSIBLE: Es una posibilidad (disyunción pendiente de resolver: P? o W?).
 * - KNOWN_YES: Se ha demostrado con certeza absoluta que CONTIENE la amenaza (P o W).
 */

export const CellStatus = {
    UNKNOWN: 'UNKNOWN',
    NO: 'NO',                 // Demostrado que NO hay peligro
    POSSIBLE: 'POSSIBLE',     // Posible peligro (incertidumbre)
    KNOWN_YES: 'KNOWN_YES'    // Peligro confirmado
};

export class KnowledgeBase {
    constructor(width = 4, height = 4) {
        this.width = width;
        this.height = height;

        // Registro de casillas visitadas
        this.visited = new Set();
        
        // Historial de percepciones por casilla: "x,y" -> Perception
        this.perceptions = new Map();

        // Estados inferidos para cada celda
        this.pitStatus = new Map();       // "x,y" -> CellStatus
        this.wumpusStatus = new Map();    // "x,y" -> CellStatus
        this.safeCells = new Set();       // "x,y" probadas seguras (¬P ∧ ¬W)
        
        // Hechos globales inferidos
        this.goldLocation = null;         // {x, y} o null
        this.exactWumpusLocation = null;  // {x, y} deducido con certeza
        this.wumpusDead = false;

        // Historial académico de deducciones e inferencias
        this.inferenceLog = [];
        this.currentStepDeductions = [];
        this.appliedRules = [];

        this.initGrid();
    }

    /**
     * Inicializa las proposiciones de la cuadrícula
     */
    initGrid() {
        for (let x = 1; x <= this.width; x++) {
            for (let y = 1; y <= this.height; y++) {
                const k = this.key(x, y);
                this.pitStatus.set(k, CellStatus.UNKNOWN);
                this.wumpusStatus.set(k, CellStatus.UNKNOWN);
            }
        }

        // Axioma inicial: La casilla de inicio (1,1) siempre es segura
        const startKey = this.key(1, 1);
        this.pitStatus.set(startKey, CellStatus.NO);
        this.wumpusStatus.set(startKey, CellStatus.NO);
        this.safeCells.add(startKey);
    }

    key(x, y) {
        return `${x},${y}`;
    }

    parseKey(k) {
        const [x, y] = k.split(',').map(Number);
        return { x, y };
    }

    isValid(x, y) {
        return x >= 1 && x <= this.width && y >= 1 && y <= this.height;
    }

    getAdjacent(x, y) {
        const neighbors = [
            { x: x, y: y + 1 },
            { x: x + 1, y: y },
            { x: x, y: y - 1 },
            { x: x - 1, y: y }
        ];
        return neighbors.filter(p => this.isValid(p.x, p.y));
    }

    /**
     * Registra que el agente visitó una casilla y almacena sus percepciones
     */
    recordVisit(x, y, perception) {
        const k = this.key(x, y);
        this.visited.add(k);
        this.perceptions.set(k, perception);

        // Toda casilla visitada es por definición segura
        this.pitStatus.set(k, CellStatus.NO);
        this.wumpusStatus.set(k, CellStatus.NO);
        this.safeCells.add(k);
    }

    /**
     * Marca una casilla como libre de hoyo
     */
    setNoPit(x, y) {
        const k = this.key(x, y);
        this.pitStatus.set(k, CellStatus.NO);
        this.checkAndMarkSafe(x, y);
    }

    /**
     * Marca una casilla como posible hoyo (si no se ha probado libre)
     */
    setPossiblePit(x, y) {
        const k = this.key(x, y);
        if (this.pitStatus.get(k) !== CellStatus.NO && this.pitStatus.get(k) !== CellStatus.KNOWN_YES) {
            this.pitStatus.set(k, CellStatus.POSSIBLE);
        }
    }

    /**
     * Marca una casilla con hoyo confirmado
     */
    setConfirmedPit(x, y) {
        const k = this.key(x, y);
        this.pitStatus.set(k, CellStatus.KNOWN_YES);
        this.safeCells.delete(k);
    }

    /**
     * Marca una casilla como libre de Wumpus
     */
    setNoWumpus(x, y) {
        const k = this.key(x, y);
        this.wumpusStatus.set(k, CellStatus.NO);
        this.checkAndMarkSafe(x, y);
    }

    /**
     * Marca una casilla como posible Wumpus (si no se ha probado libre)
     */
    setPossibleWumpus(x, y) {
        const k = this.key(x, y);
        if (this.wumpusDead) {
            this.wumpusStatus.set(k, CellStatus.NO);
            this.checkAndMarkSafe(x, y);
            return;
        }
        if (this.wumpusStatus.get(k) !== CellStatus.NO && this.wumpusStatus.get(k) !== CellStatus.KNOWN_YES) {
            this.wumpusStatus.set(k, CellStatus.POSSIBLE);
        }
    }

    /**
     * Marca una casilla con Wumpus confirmado
     */
    setConfirmedWumpus(x, y) {
        const k = this.key(x, y);
        this.exactWumpusLocation = { x, y };
        this.wumpusStatus.set(k, CellStatus.KNOWN_YES);
        this.safeCells.delete(k);

        // Al haber solo UN Wumpus, todas las demás casillas quedan descartadas de Wumpus
        for (let gx = 1; gx <= this.width; gx++) {
            for (let gy = 1; gy <= this.height; gy++) {
                if (gx !== x || gy !== y) {
                    this.setNoWumpus(gx, gy);
                }
            }
        }
    }

    /**
     * Verifica si una casilla cumple la Regla 5: OK(x,y) <=> ¬P(x,y) ∧ ¬W(x,y)
     */
    checkAndMarkSafe(x, y) {
        const k = this.key(x, y);
        const p = this.pitStatus.get(k);
        const w = this.wumpusStatus.get(k);

        if (p === CellStatus.NO && (w === CellStatus.NO || this.wumpusDead)) {
            this.safeCells.add(k);
            return true;
        }
        return false;
    }

    /**
     * Notifica la muerte del Wumpus y actualiza todo el conocimiento
     */
    markWumpusDead(killedCell = null) {
        const knownWumpusCell = killedCell || this.exactWumpusLocation;
        this.wumpusDead = true;
        this.exactWumpusLocation = null;
        if (knownWumpusCell) {
            this.setNoPit(knownWumpusCell.x, knownWumpusCell.y);
        }
        for (let x = 1; x <= this.width; x++) {
            for (let y = 1; y <= this.height; y++) {
                this.setNoWumpus(x, y);
            }
        }
    }

    getWumpusCandidates() {
        if (this.wumpusDead) return [];
        if (this.exactWumpusLocation) return [this.exactWumpusLocation];

        const stenchPositions = Array.from(this.perceptions.entries())
            .filter(([, perception]) => perception.stench)
            .map(([key]) => this.parseKey(key));
        let constrainedKeys = null;

        for (const position of stenchPositions) {
            const adjacentKeys = new Set(this.getAdjacent(position.x, position.y)
                .map(cell => this.key(cell.x, cell.y)));
            constrainedKeys = constrainedKeys === null
                ? adjacentKeys
                : new Set([...constrainedKeys].filter(key => adjacentKeys.has(key)));
        }

        const candidates = [];
        for (let x = 1; x <= this.width; x++) {
            for (let y = 1; y <= this.height; y++) {
                const key = this.key(x, y);
                if (this.wumpusStatus.get(key) === CellStatus.NO) continue;
                if (constrainedKeys && !constrainedKeys.has(key)) continue;
                candidates.push({ x, y });
            }
        }
        return candidates;
    }

    getWumpusProbability(x, y) {
        const candidates = this.getWumpusCandidates();
        if (candidates.length === 0) return 0;
        return candidates.some(cell => cell.x === x && cell.y === y)
            ? 1 / candidates.length
            : 0;
    }

    getPitProbability(x, y, prior = 0.2) {
        const targetStatus = this.pitStatus.get(this.key(x, y));
        if (targetStatus === CellStatus.NO) return 0;
        if (targetStatus === CellStatus.KNOWN_YES) return 1;

        return this.getPitEventProbability(hasPit => hasPit(x, y), prior);
    }

    getPitEventProbability(isEventTrue, prior) {

        const uncertainCells = [];
        for (let gx = 1; gx <= this.width; gx++) {
            for (let gy = 1; gy <= this.height; gy++) {
                const status = this.pitStatus.get(this.key(gx, gy));
                if (status !== CellStatus.NO && status !== CellStatus.KNOWN_YES) {
                    uncertainCells.push({ x: gx, y: gy });
                }
            }
        }

        if (uncertainCells.length > 20) return prior;

        const variableIndexes = new Map(uncertainCells.map((cell, index) => [
            this.key(cell.x, cell.y), index
        ]));
        const assignmentCount = 1 << uncertainCells.length;
        let totalWeight = 0;
        let targetWeight = 0;

        for (let mask = 0; mask < assignmentCount; mask++) {
            let weight = 1;
            for (let index = 0; index < uncertainCells.length; index++) {
                weight *= mask & (1 << index) ? prior : 1 - prior;
            }
            if (weight === 0) continue;

            const hasPit = (cellX, cellY) => {
                const key = this.key(cellX, cellY);
                const status = this.pitStatus.get(key);
                if (status === CellStatus.KNOWN_YES) return true;
                if (status === CellStatus.NO) return false;
                const index = variableIndexes.get(key);
                return index !== undefined && Boolean(mask & (1 << index));
            };

            let consistent = true;
            for (const [perceptionKey, perception] of this.perceptions.entries()) {
                if (!consistent) break;
                const position = this.parseKey(perceptionKey);
                const adjacentHasPit = this.getAdjacent(position.x, position.y)
                    .some(cell => hasPit(cell.x, cell.y));
                if (adjacentHasPit !== perception.breeze) {
                    consistent = false;
                    break;
                }
            }
            if (!consistent) continue;

            totalWeight += weight;
            if (isEventTrue(hasPit)) targetWeight += weight;
        }

        return totalWeight > 0 ? targetWeight / totalWeight : prior;
    }

    getUniqueWumpusCandidateOnPath(path) {
        const pathKeys = new Set(path.map(cell => this.key(cell.x, cell.y)));
        const candidatesOnPath = this.getWumpusCandidates()
            .filter(cell => pathKeys.has(this.key(cell.x, cell.y)));
        return candidatesOnPath.length === 1 ? candidatesOnPath[0] : null;
    }

    markNoWumpusAlongPath(path) {
        for (const cell of path) {
            this.setNoWumpus(cell.x, cell.y);
        }
    }

    /**
     * Obtiene el estado consolidado de una casilla para la UI
     */
    getCellKnowledge(x, y) {
        const k = this.key(x, y);
        const visited = this.visited.has(k);
        const isSafe = this.safeCells.has(k);
        const pStatus = this.pitStatus.get(k);
        const wStatus = this.wumpusStatus.get(k);
        const perception = this.perceptions.get(k) || null;

        return {
            x,
            y,
            visited,
            isSafe,
            pitStatus: pStatus,
            wumpusStatus: wStatus,
            perception,
            isGold: this.goldLocation && this.goldLocation.x === x && this.goldLocation.y === y,
            isWumpus: this.exactWumpusLocation && this.exactWumpusLocation.x === x && this.exactWumpusLocation.y === y
        };
    }

    /**
     * Retorna todas las casillas que son seguras pero que aún NO han sido visitadas
     */
    getUnvisitedSafeCells() {
        const result = [];
        for (const k of this.safeCells) {
            if (!this.visited.has(k)) {
                result.push(this.parseKey(k));
            }
        }
        return result;
    }

    /**
     * Resumen en texto de la Base de Conocimiento para el panel lateral
     */
    getSummary() {
        const visitedList = Array.from(this.visited).sort();
        const safeList = Array.from(this.safeCells).sort();
        
        const possiblePits = [];
        const confirmedPits = [];
        for (const [k, status] of this.pitStatus.entries()) {
            if (status === CellStatus.POSSIBLE) possiblePits.push(k);
            if (status === CellStatus.KNOWN_YES) confirmedPits.push(k);
        }

        const possibleWumpus = [];
        for (const [k, status] of this.wumpusStatus.entries()) {
            if (status === CellStatus.POSSIBLE) possibleWumpus.push(k);
        }

        return {
            visited: visitedList,
            safe: safeList,
            possiblePits: possiblePits.sort(),
            confirmedPits: confirmedPits.sort(),
            possibleWumpus: possibleWumpus.sort(),
            exactWumpus: this.exactWumpusLocation ? `(${this.exactWumpusLocation.x}, ${this.exactWumpusLocation.y})` : null,
            wumpusDead: this.wumpusDead,
            goldLocation: this.goldLocation ? `(${this.goldLocation.x}, ${this.goldLocation.y})` : null
        };
    }
}
