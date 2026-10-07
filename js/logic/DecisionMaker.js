/**
 * Tomador de Decisiones del Agente Lógico (Decision Maker)
 * 
 * Selecciona la acción óptima basándose en el estado del agente, las conclusiones de la
 * Base de Conocimiento y las prioridades racionales:
 * 1. Tomar el Oro si se percibe brillo en la casilla actual.
 * 2. Si ya tiene el oro, retornar con seguridad a la salida (1,1) para ganar.
 * 3. Explorar la casilla segura (OK) no visitada más cercana navegando por casillas seguras.
 * 4. Si el Wumpus bloquea el camino y su posición es conocida, disparar flecha.
 * 5. Si no hay más casillas 100% seguras, evaluar el menor riesgo probabilístico.
 */

import { CellStatus } from './KnowledgeBase.js';

export const Actions = {
    MOVE_UP: 'MOVER ARRIBA',
    MOVE_DOWN: 'MOVER ABAJO',
    MOVE_LEFT: 'MOVER IZQUIERDA',
    MOVE_RIGHT: 'MOVER DERECHA',
    GRAB_GOLD: 'TOMAR ORO',
    SHOOT_UP: 'DISPARAR ARRIBA',
    SHOOT_DOWN: 'DISPARAR ABAJO',
    SHOOT_LEFT: 'DISPARAR IZQUIERDA',
    SHOOT_RIGHT: 'DISPARAR DERECHA',
    CLIMB: 'SALIR DE LA CAVERNA'
};

export class DecisionMaker {
    constructor(knowledgeBase) {
        this.kb = knowledgeBase;
    }

    /**
     * Toma una decisión racional basada en la Base de Conocimiento
     * @param {Object} agentState - { x, y, hasGold, hasArrow, isAlive }
     * @param {Perception} perception - Percepción sensorial actual
     * @returns {Object} { action, targetCell, rationale, path }
     */
    decide(agentState, perception) {
        const { x, y, hasGold, hasArrow } = agentState;

        // 1. PRIORIDAD: TOMAR ORO
        if (perception.glitter || (this.kb.goldLocation && this.kb.goldLocation.x === x && this.kb.goldLocation.y === y && !hasGold)) {
            return {
                action: Actions.GRAB_GOLD,
                targetCell: { x, y },
                rationale: `Se percibe brillo en (${x}, ${y}). Acción inmediata: TOMAR ORO.`,
                path: []
            };
        }

        // 2. PRIORIDAD: RETORNAR A LA ENTRADA TRAS CONSEGUIR EL ORO
        if (hasGold) {
            if (x === 1 && y === 1) {
                return {
                    action: Actions.CLIMB,
                    targetCell: { x: 1, y: 1 },
                    rationale: `El agente tiene el oro y está en la salida (1, 1). Acción: SALIR DE LA CAVERNA (Misión cumplida).`,
                    path: []
                };
            }

            // Navegar de regreso a (1,1) a través de casillas seguras
            const returnPath = this.findPathThroughSafeCells({ x, y }, { x: 1, y: 1 });
            if (returnPath && returnPath.length > 1) {
                const nextStep = returnPath[1];
                const moveAction = this.getMoveAction({ x, y }, nextStep);
                return {
                    action: moveAction,
                    targetCell: nextStep,
                    rationale: `Con el oro obtenido, el agente regresa hacia la salida (1, 1) por ruta segura: [ ${returnPath.map(p => `(${p.x},${p.y})`).join(' -> ')} ].`,
                    path: returnPath
                };
            }
        }

        // 3. PRIORIDAD: EXPLORAR CASILLAS SEGURAS NO VISITADAS
        const unvisitedSafe = this.kb.getUnvisitedSafeCells();
        if (unvisitedSafe.length > 0) {
            // Encontrar la casilla segura no visitada con la ruta segura más corta
            let bestTarget = null;
            let shortestPath = null;

            for (const candidate of unvisitedSafe) {
                const path = this.findPathThroughSafeCells({ x, y }, candidate);
                if (path && (!shortestPath || path.length < shortestPath.length)) {
                    shortestPath = path;
                    bestTarget = candidate;
                }
            }

            if (shortestPath && shortestPath.length > 1) {
                const nextStep = shortestPath[1];
                const moveAction = this.getMoveAction({ x, y }, nextStep);
                return {
                    action: moveAction,
                    targetCell: nextStep,
                    goalCell: bestTarget,
                    rationale: `Objetivo: Explorar casilla segura (${bestTarget.x}, ${bestTarget.y}). Próximo paso seguro a (${nextStep.x}, ${nextStep.y}) mediante inferencia lógica previa.`,
                    path: shortestPath
                };
            }
        }

        // 4. PRIORIDAD: DISPARAR AL WUMPUS SI ESTÁ LOCALIZADO Y TENEMOS FLECHA
        if (hasArrow && this.kb.exactWumpusLocation && !this.kb.wumpusDead) {
            const wLoc = this.kb.exactWumpusLocation;
            // Verificar si el agente está alineado ortogonalmente con el Wumpus
            if (x === wLoc.x || y === wLoc.y) {
                let shootAction = null;
                if (x === wLoc.x && wLoc.y > y) shootAction = Actions.SHOOT_UP;
                else if (x === wLoc.x && wLoc.y < y) shootAction = Actions.SHOOT_DOWN;
                else if (y === wLoc.y && wLoc.x > x) shootAction = Actions.SHOOT_RIGHT;
                else if (y === wLoc.y && wLoc.x < x) shootAction = Actions.SHOOT_LEFT;

                if (shootAction) {
                    return {
                        action: shootAction,
                        targetCell: wLoc,
                        rationale: `El Wumpus fue localizado en (${wLoc.x}, ${wLoc.y}) y el agente está alineado. Acción: DISPARAR FLECHA.`,
                        path: []
                    };
                }
            }
        }

        // 5. PRIORIDAD: EVALUACIÓN DE MENOR RIESGO (Si no hay casillas 100% seguras)
        const riskAssessment = this.evaluateLeastRiskyCell({ x, y });
        if (riskAssessment) {
            const nextStep = riskAssessment.target;
            const moveAction = this.getMoveAction({ x, y }, nextStep);
            return {
                action: moveAction,
                targetCell: nextStep,
                rationale: `No existen más casillas 100% seguras. Análisis de Riesgo: Se selecciona (${nextStep.x}, ${nextStep.y}) con menor factor de riesgo (${riskAssessment.riskScore}%).`,
                path: [{ x, y }, nextStep]
            };
        }

        // 6. Sin movimientos posibles: Regresar al inicio
        if (x !== 1 || y !== 1) {
            const fallbackPath = this.findPathThroughSafeCells({ x, y }, { x: 1, y: 1 });
            if (fallbackPath && fallbackPath.length > 1) {
                const nextStep = fallbackPath[1];
                return {
                    action: this.getMoveAction({ x, y }, nextStep),
                    targetCell: nextStep,
                    rationale: `No hay más opciones seguras. El agente se repliega a la salida.`,
                    path: fallbackPath
                };
            }
        }

        return {
            action: Actions.CLIMB,
            targetCell: { x: 1, y: 1 },
            rationale: `Agente sin acciones viables. Termina la exploración en la base.`,
            path: []
        };
    }

    /**
     * Búsqueda en Anchura (BFS) para encontrar la ruta más corta a través de casillas probadas como SEGURAS
     */
    findPathThroughSafeCells(start, target) {
        if (start.x === target.x && start.y === target.y) {
            return [start];
        }

        const queue = [[start]];
        const visited = new Set([this.kb.key(start.x, start.y)]);

        while (queue.length > 0) {
            const currentPath = queue.shift();
            const current = currentPath[currentPath.length - 1];

            if (current.x === target.x && current.y === target.y) {
                return currentPath;
            }

            const adjacents = this.kb.getAdjacent(current.x, current.y);
            for (const next of adjacents) {
                const nextKey = this.kb.key(next.x, next.y);
                // Puede avanzar si es la casilla destino (que es segura) o si ya está marcada como segura en la KB
                const isCandidateSafe = this.kb.safeCells.has(nextKey) || (next.x === target.x && next.y === target.y);

                if (isCandidateSafe && !visited.has(nextKey)) {
                    visited.add(nextKey);
                    queue.push([...currentPath, next]);
                }
            }
        }

        return null; // No hay ruta segura conectada
    }

    /**
     * Convierte un par de casillas consecutivas en una acción direccional
     */
    getMoveAction(from, to) {
        if (to.y > from.y) return Actions.MOVE_UP;
        if (to.y < from.y) return Actions.MOVE_DOWN;
        if (to.x > from.x) return Actions.MOVE_RIGHT;
        if (to.x < from.x) return Actions.MOVE_LEFT;
        return Actions.CLIMB;
    }

    /**
     * Evaluación de menor riesgo cuando se agotan las casillas seguras conocidas
     */
    evaluateLeastRiskyCell(currentPos) {
        const adjacents = this.kb.getAdjacent(currentPos.x, currentPos.y);
        const unvisitedAdj = adjacents.filter(p => !this.kb.visited.has(this.kb.key(p.x, p.y)));

        if (unvisitedAdj.length === 0) return null;

        let bestCell = null;
        let lowestRisk = Infinity;

        for (const cell of unvisitedAdj) {
            const k = this.kb.key(cell.x, cell.y);
            const pit = this.kb.pitStatus.get(k);
            const wumpus = this.kb.wumpusStatus.get(k);

            // Si es peligro confirmado, evitar a toda costa
            if (pit === CellStatus.KNOWN_YES || wumpus === CellStatus.KNOWN_YES) {
                continue;
            }

            let risk = 0;
            if (pit === CellStatus.POSSIBLE) risk += 50;
            if (wumpus === CellStatus.POSSIBLE && !this.kb.wumpusDead) risk += 50;
            if (pit === CellStatus.UNKNOWN) risk += 20;

            if (risk < lowestRisk) {
                lowestRisk = risk;
                bestCell = cell;
            }
        }

        if (bestCell) {
            return { target: bestCell, riskScore: lowestRisk };
        }

        return unvisitedAdj.length > 0 ? { target: unvisitedAdj[0], riskScore: 80 } : null;
    }
}
