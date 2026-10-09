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

const GOLD_REWARD = 1000;
const DEATH_PENALTY = 1000;
const ACTION_COST = 1;
const CLIMB_UTILITY = -ACTION_COST;

export const Actions = {
    MOVE_UP: 'MOVER ARRIBA',
    MOVE_DOWN: 'MOVER ABAJO',
    MOVE_LEFT: 'MOVER IZQUIERDA',
    MOVE_RIGHT: 'MOVER DERECHA',
    TURN_LEFT: 'GIRAR IZQUIERDA',
    TURN_RIGHT: 'GIRAR DERECHA',
    GRAB_GOLD: 'TOMAR ORO',
    SHOOT: 'DISPARAR',
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
        const { x, y, hasGold, hasArrow, orientation = 'DERECHA', score = 0 } = agentState;

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

            // Preferir una ruta demostrada segura; si no existe, minimizar el riesgo al volver.
            const returnPath = this.findPathThroughSafeCells({ x, y }, { x: 1, y: 1 });
            const safestReturnPath = returnPath || this.findLeastRiskPathToStart({ x, y });
            if (safestReturnPath && safestReturnPath.length > 1) {
                const nextStep = safestReturnPath[1];
                const moveAction = this.getMoveAction({ x, y }, nextStep);
                return {
                    action: moveAction,
                    targetCell: nextStep,
                    rationale: `Con el oro obtenido, el agente regresa hacia la salida (1, 1) por la ruta de menor riesgo.`,
                    path: safestReturnPath
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

        // 4. PRIORIDAD: DISPARO TÁCTICO A CANDIDATOS ALINEADOS
        const hasWumpusEvidence = perception.stench || this.kb.exactWumpusLocation;
        const shotDirection = hasArrow && hasWumpusEvidence && !this.kb.wumpusDead
            ? this.findShotDirection({ x, y })
            : null;
        if (shotDirection) {
            if (orientation !== shotDirection.direction) {
                return {
                    action: this.getTurnAction(orientation, shotDirection.direction),
                    targetCell: shotDirection.target,
                    rationale: `Se orienta hacia la trayectoria sospechosa (${shotDirection.direction}) antes de disparar.`,
                    path: []
                };
            }
            return {
                action: Actions.SHOOT,
                targetCell: shotDirection.target,
                rationale: `La flecha se dispara hacia ${orientation} por una trayectoria con Wumpus sospechoso.`,
                path: []
            };
        }

        // 5. Evaluar la frontera completa antes de asumir más riesgo.
        const frontierAssessment = this.evaluateFrontierRisk({ x, y }, score);
        if (!frontierAssessment || frontierAssessment.expectedFinalScore < frontierAssessment.retreatScore) {
            return this.retreatToStart({ x, y }, frontierAssessment);
        }

        const routeToFrontier = [
            ...frontierAssessment.safePath,
            frontierAssessment.target
        ];
        if (routeToFrontier.length > 1) {
            const nextStep = routeToFrontier[1];
            return {
                action: this.getMoveAction({ x, y }, nextStep),
                targetCell: nextStep,
                rationale: `La mejor casilla disponible (${frontierAssessment.target.x}, ${frontierAssessment.target.y}) tiene ${frontierAssessment.deathProbabilityPercent}% de riesgo. Su utilidad esperada es ${frontierAssessment.expectedFinalScore.toFixed(1)} frente a ${frontierAssessment.retreatScore.toFixed(1)} al retirarse; se continúa explorando.`,
                path: routeToFrontier
            };
        }

        return this.retreatToStart({ x, y }, frontierAssessment);
    }

    evaluateFrontierRisk(position, currentScore) {
        const frontierByKey = new Map();
        for (const visitedKey of this.kb.visited) {
            const origin = this.kb.parseKey(visitedKey);
            const safePath = this.findPathThroughSafeCells(position, origin);
            if (!safePath) continue;

            for (const cell of this.kb.getAdjacent(origin.x, origin.y)) {
                const key = this.kb.key(cell.x, cell.y);
                if (this.kb.visited.has(key) || this.kb.safeCells.has(key)) continue;
                if (this.kb.pitStatus.get(key) === CellStatus.KNOWN_YES ||
                    this.kb.wumpusStatus.get(key) === CellStatus.KNOWN_YES) continue;

                const riskProbability = this.getCellDeathProbability(cell.x, cell.y);
                const previous = frontierByKey.get(key);
                if (!previous || safePath.length < previous.safePath.length) {
                    frontierByKey.set(key, { target: cell, origin, safePath, riskProbability });
                }
            }
        }

        const frontier = Array.from(frontierByKey.values());
        if (frontier.length === 0) return null;

        const wumpusCandidates = this.kb.getWumpusCandidates();
        for (const candidate of frontier) {
            const pitProbability = this.kb.getPitProbability(candidate.target.x, candidate.target.y);
            const wumpusProbability = wumpusCandidates.length > 0 && wumpusCandidates.some(cell =>
                cell.x === candidate.target.x && cell.y === candidate.target.y
            ) ? 1 / wumpusCandidates.length : 0;
            candidate.riskProbability = 1 - (1 - pitProbability) * (1 - wumpusProbability);
            candidate.expectedScore = currentScore +
                (1 - candidate.riskProbability) * GOLD_REWARD -
                candidate.riskProbability * DEATH_PENALTY -
                ACTION_COST;
        }

        const safeReturnPath = this.findPathThroughSafeCells(position, { x: 1, y: 1 }) ||
            this.findLeastRiskPathToStart(position);
        const retreatActions = (safeReturnPath?.length || 1) - 1 + 1;
        const retreatScore = currentScore - retreatActions * ACTION_COST;

        frontier.sort((a, b) => b.expectedScore - a.expectedScore || a.safePath.length - b.safePath.length);
        const bestCandidate = frontier[0];
        return {
            frontier,
            target: bestCandidate.target,
            safePath: bestCandidate.safePath,
            deathProbability: bestCandidate.riskProbability,
            deathProbabilityPercent: Math.round(bestCandidate.riskProbability * 100),
            expectedFinalScore: bestCandidate.expectedScore,
            retreatScore
        };
    }

    findShotDirection(position) {
        const candidates = this.kb.getWumpusCandidates();
        const directions = [
            { direction: 'ARRIBA', matches: cell => cell.x === position.x && cell.y > position.y, distance: cell => cell.y - position.y },
            { direction: 'DERECHA', matches: cell => cell.y === position.y && cell.x > position.x, distance: cell => cell.x - position.x },
            { direction: 'ABAJO', matches: cell => cell.x === position.x && cell.y < position.y, distance: cell => position.y - cell.y },
            { direction: 'IZQUIERDA', matches: cell => cell.y === position.y && cell.x < position.x, distance: cell => position.x - cell.x }
        ];
        const viableDirections = directions.map(option => {
            const targets = candidates.filter(option.matches);
            return targets.length === 1 ? {
                direction: option.direction,
                targets,
                target: targets.sort((a, b) => option.distance(a) - option.distance(b))[0]
            } : null;
        }).filter(Boolean);

        viableDirections.sort((a, b) => a.targets.length - b.targets.length);
        const selected = viableDirections[0];
        return selected ? { direction: selected.direction, target: selected.target } : null;
    }

    getTurnAction(currentOrientation, targetOrientation) {
        const orientations = ['ARRIBA', 'DERECHA', 'ABAJO', 'IZQUIERDA'];
        const currentIndex = orientations.indexOf(currentOrientation);
        const targetIndex = orientations.indexOf(targetOrientation);
        if (currentIndex < 0 || targetIndex < 0) return Actions.TURN_RIGHT;
        const clockwiseTurns = (targetIndex - currentIndex + orientations.length) % orientations.length;
        return clockwiseTurns <= 2 ? Actions.TURN_RIGHT : Actions.TURN_LEFT;
    }

    retreatToStart(position, frontierAssessment = null) {
        const assessmentText = frontierAssessment
            ? `La mejor casilla disponible tiene ${frontierAssessment.deathProbabilityPercent}% de riesgo; su utilidad esperada sería ${frontierAssessment.expectedFinalScore.toFixed(1)}, frente a ${frontierAssessment.retreatScore.toFixed(1)} al retirarse con el puntaje actual. `
            : '';
        if (position.x === 1 && position.y === 1) {
            return {
                action: Actions.CLIMB,
                targetCell: { x: 1, y: 1 },
                rationale: `${assessmentText}Se abandona la caverna y se conserva el puntaje actual.`,
                path: []
            };
        }

        const path = this.findLeastRiskPathToStart(position);
        if (path && path.length > 1) {
            const nextStep = path[1];
            return {
                action: this.getMoveAction(position, nextStep),
                targetCell: nextStep,
                rationale: `${assessmentText}Se retira hacia la salida por la ruta segura disponible.`,
                path
            };
        }

        return {
            action: Actions.CLIMB,
            targetCell: { x: 1, y: 1 },
            rationale: 'No se encontró una ruta de retorno; el agente intenta abandonar la caverna.',
            path: []
        };
    }

    findLeastRiskPathToStart(start) {
        const startKey = this.kb.key(start.x, start.y);
        const targetKey = this.kb.key(1, 1);
        const frontier = [{ cell: start, path: [start], cost: 0 }];
        const bestCosts = new Map([[startKey, 0]]);

        while (frontier.length > 0) {
            frontier.sort((a, b) => a.cost - b.cost);
            const current = frontier.shift();
            const currentKey = this.kb.key(current.cell.x, current.cell.y);
            if (current.cost > bestCosts.get(currentKey)) continue;
            if (currentKey === targetKey) return current.path;

            for (const next of this.kb.getAdjacent(current.cell.x, current.cell.y)) {
                const nextKey = this.kb.key(next.x, next.y);
                const risk = this.getCellDeathProbability(next.x, next.y);
                const cost = current.cost + 1 + risk * 1000;
                if (cost < (bestCosts.get(nextKey) ?? Infinity)) {
                    bestCosts.set(nextKey, cost);
                    frontier.push({ cell: next, path: [...current.path, next], cost });
                }
            }
        }
        return null;
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

            const pitProbability = this.kb.getPitProbability(cell.x, cell.y, 0.2);
            const wumpusProbability = this.kb.getWumpusProbability(cell.x, cell.y);
            const risk = 1 - (1 - pitProbability) * (1 - wumpusProbability);

            if (risk < lowestRisk) {
                lowestRisk = risk;
                bestCell = cell;
            }
        }

        if (bestCell) {
            return {
                target: bestCell,
                riskScore: Math.round(lowestRisk * 100),
                riskProbability: lowestRisk,
                expectedUtility: (1 - lowestRisk) * GOLD_REWARD - lowestRisk * DEATH_PENALTY - ACTION_COST
            };
        }

        return null;
    }

    getCellDeathProbability(x, y) {
        const key = this.kb.key(x, y);
        if (this.kb.pitStatus.get(key) === CellStatus.KNOWN_YES ||
            this.kb.wumpusStatus.get(key) === CellStatus.KNOWN_YES) return 1;
        const pitProbability = this.kb.getPitProbability(x, y, 0.2);
        const wumpusProbability = this.kb.getWumpusProbability(x, y);
        return 1 - (1 - pitProbability) * (1 - wumpusProbability);
    }
}
