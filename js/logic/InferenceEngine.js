/**
 * Motor de Inferencia Lógica (Inference Engine)
 * 
 * Implementa el razonamiento deductivo proposicional (Forward Chaining & Model Elimination)
 * para derivar nuevos hechos y teoremas de seguridad a partir de las percepciones
 * y la Base de Conocimiento.
 */

import { CellStatus } from './KnowledgeBase.js';
import { RULES } from './Rules.js';

export class InferenceEngine {
    constructor(knowledgeBase) {
        this.kb = knowledgeBase;
    }

    /**
     * Ciclo principal de inferencia lógica al recibir una percepción en la casilla actual
     * @param {number} curX - Coordenada X actual
     * @param {number} curY - Coordenada Y actual
     * @param {Perception} perception - Percepciones sensoriales actuales
     * @returns {Object} Reporte detallado de inferencias, reglas aplicadas y conclusiones
     */
    infer(curX, curY, perception, shotResult = null) {
        const reasoningStep = {
            position: { x: curX, y: curY },
            perceptions: perception,
            appliedRules: [],
            deductions: [],
            newSafeCells: [],
            newDangerCells: []
        };

        const adjacents = this.kb.getAdjacent(curX, curY);

        if (shotResult && !shotResult.hit) {
            this.kb.markNoWumpusAlongPath(shotResult.path);
            reasoningStep.deductions.push('[Disparo] Sin grito: se descarta Wumpus en toda la trayectoria de la flecha.');
        }

        // =========================================================================
        // 1. REGLA 8: ORO DETECTADO POR BRILLO
        // =========================================================================
        if (perception.glitter) {
            this.kb.goldLocation = { x: curX, y: curY };
            reasoningStep.appliedRules.push(RULES.find(r => r.id === 'R8_GLITTER_GOLD'));
            reasoningStep.deductions.push(`[Regla 8] BRILLO en (${curX}, ${curY}): Se concluye que el ORO está en esta casilla.`);
        }

        // =========================================================================
        // 2. REGLA 9: GRITO DEL WUMPUS (SI ACABA DE MORIR)
        // =========================================================================
        if (perception.scream || this.kb.wumpusDead) {
            if (!this.kb.wumpusDead) {
                const killedCell = shotResult && shotResult.hit
                    ? this.kb.getUniqueWumpusCandidateOnPath(shotResult.path)
                    : this.kb.exactWumpusLocation;
                this.kb.markWumpusDead(killedCell);
                reasoningStep.appliedRules.push(RULES.find(r => r.id === 'R9_DEAD_WUMPUS'));
                reasoningStep.deductions.push(killedCell
                    ? `[Regla 9] GRITO escuchado: El Wumpus murió en (${killedCell.x}, ${killedCell.y}); esa casilla queda SEGURA.`
                    : '[Regla 9] GRITO escuchado: El Wumpus ha muerto. Todas las casillas quedan libres de Wumpus.');
            }
        }

        // =========================================================================
        // 3. REGLA 1 & REGLA 2: INFERENCIA DE HOYOS (BRISA / NO BRISA)
        // =========================================================================
        if (!perception.breeze) {
            // Regla 1: ¬Brisa(x,y) ⇒ ¬Hoyo en todas las adyacentes
            reasoningStep.appliedRules.push(RULES.find(r => r.id === 'R1_NO_BREEZE'));
            for (const adj of adjacents) {
                const prevPit = this.kb.pitStatus.get(this.kb.key(adj.x, adj.y));
                if (prevPit !== CellStatus.NO) {
                    this.kb.setNoPit(adj.x, adj.y);
                    reasoningStep.deductions.push(`[Regla 1] Sin brisa en (${curX}, ${curY}) ⇒ Demostrado: ¬Hoyo(${adj.x}, ${adj.y}).`);
                }
            }
        } else {
            // Regla 2: Brisa(x,y) ⇒ Al menos un adyacente tiene hoyo (Disyunción)
            reasoningStep.appliedRules.push(RULES.find(r => r.id === 'R2_BREEZE_DISJUNCTION'));
            const possiblePitsInAdj = [];
            
            for (const adj of adjacents) {
                const status = this.kb.pitStatus.get(this.kb.key(adj.x, adj.y));
                if (status !== CellStatus.NO) {
                    this.kb.setPossiblePit(adj.x, adj.y);
                    possiblePitsInAdj.push(adj);
                }
            }

            if (possiblePitsInAdj.length > 1) {
                const coordsText = possiblePitsInAdj.map(p => `(${p.x}, ${p.y})`).join(' ∨ ');
                reasoningStep.deductions.push(`[Regla 2] Brisa en (${curX}, ${curY}) ⇒ Existe hoyo en: [ ${coordsText} ] (Incertidumbre).`);
            } else if (possiblePitsInAdj.length === 1) {
                // Regla 7: Resolución de Hoyo Único
                const target = possiblePitsInAdj[0];
                this.kb.setConfirmedPit(target.x, target.y);
                reasoningStep.appliedRules.push(RULES.find(r => r.id === 'R7_PIT_RESOLUTION'));
                reasoningStep.deductions.push(`[Regla 7] Resolución: Solo (${target.x}, ${target.y}) puede explicar la brisa en (${curX}, ${curY}) ⇒ HOYO confirmado.`);
                reasoningStep.newDangerCells.push(target);
            }
        }

        // =========================================================================
        // 4. REGLA 3, 4 & 6: INFERENCIA DEL WUMPUS (HEDOR / NO HEDOR / INTERSECCIÓN)
        // =========================================================================
        if (!this.kb.wumpusDead) {
            if (!perception.stench) {
                // Regla 3: ¬Hedor(x,y) ⇒ ¬Wumpus en todas las adyacentes
                reasoningStep.appliedRules.push(RULES.find(r => r.id === 'R3_NO_STENCH'));
                for (const adj of adjacents) {
                    const prevW = this.kb.wumpusStatus.get(this.kb.key(adj.x, adj.y));
                    if (prevW !== CellStatus.NO) {
                        this.kb.setNoWumpus(adj.x, adj.y);
                        reasoningStep.deductions.push(`[Regla 3] Sin hedor en (${curX}, ${curY}) ⇒ Demostrado: ¬Wumpus(${adj.x}, ${adj.y}).`);
                    }
                }
            } else {
                // Regla 4: Hedor(x,y) ⇒ Posible Wumpus en adyacentes
                reasoningStep.appliedRules.push(RULES.find(r => r.id === 'R4_STENCH_DISJUNCTION'));
                const candidateWumpus = [];
                for (const adj of adjacents) {
                    const status = this.kb.wumpusStatus.get(this.kb.key(adj.x, adj.y));
                    if (status !== CellStatus.NO) {
                        this.kb.setPossibleWumpus(adj.x, adj.y);
                        candidateWumpus.push(adj);
                    }
                }

                if (candidateWumpus.length === 1) {
                    // Wumpus deducido directamente
                    const w = candidateWumpus[0];
                    this.kb.setConfirmedWumpus(w.x, w.y);
                    reasoningStep.appliedRules.push(RULES.find(r => r.id === 'R6_SINGLE_WUMPUS'));
                    reasoningStep.deductions.push(`[Regla 6] WUMPUS localizado con certeza en (${w.x}, ${w.y}). Todas las demás casillas libres de Wumpus.`);
                    reasoningStep.newDangerCells.push(w);
                } else if (candidateWumpus.length > 1) {
                    const coordsText = candidateWumpus.map(p => `(${p.x}, ${p.y})`).join(' ∨ ');
                    reasoningStep.deductions.push(`[Regla 4] Hedor en (${curX}, ${curY}) ⇒ Wumpus posible en: [ ${coordsText} ].`);
                }
            }
        }

        // =========================================================================
        // 5. PROPAGACIÓN GLOBAL Y RESOLUCIÓN CRUZADA (Cross-Cell Constraint Propagation)
        // =========================================================================
        this.propagateGlobalConstraints(reasoningStep);

        // =========================================================================
        // 6. REGLA 5: EVALUACIÓN DE CASILLAS SEGURAS (OK)
        // =========================================================================
        let safeRuleAdded = false;
        for (let x = 1; x <= this.kb.width; x++) {
            for (let y = 1; y <= this.height || y <= this.kb.height; y++) {
                const k = this.kb.key(x, y);
                const wasSafe = this.kb.safeCells.has(k);
                const isNowSafe = this.kb.checkAndMarkSafe(x, y);

                if (!wasSafe && isNowSafe) {
                    if (!safeRuleAdded) {
                        reasoningStep.appliedRules.push(RULES.find(r => r.id === 'R5_SAFE_CELL'));
                        safeRuleAdded = true;
                    }
                    reasoningStep.deductions.push(`[Regla 5] (¬P ∧ ¬W) en (${x}, ${y}) ⇒ Casilla (${x}, ${y}) marcada como SEGURA (OK).`);
                    reasoningStep.newSafeCells.push({ x, y });
                }
            }
        }

        // Eliminar reglas duplicadas en el paso
        reasoningStep.appliedRules = Array.from(new Set(reasoningStep.appliedRules));

        return reasoningStep;
    }

    /**
     * Propaga restricciones globales cruzando múltiples percepciones previas:
     * - Intersección de múltiples hedores para ubicar al Wumpus
     * - Eliminación de hoyos imposibles en brisas visitadas anteriormente
     */
    propagateGlobalConstraints(reasoningStep) {
        // Intersección de Hedores
        if (!this.kb.exactWumpusLocation && !this.kb.wumpusDead) {
            const stenchLocations = [];
            for (const [k, p] of this.kb.perceptions.entries()) {
                if (p.stench) {
                    stenchLocations.push(this.kb.parseKey(k));
                }
            }

            if (stenchLocations.length >= 2) {
                // Encontrar intersección de vecinos posibles
                const candidateSets = stenchLocations.map(pos => {
                    return this.kb.getAdjacent(pos.x, pos.y)
                        .filter(adj => this.kb.wumpusStatus.get(this.kb.key(adj.x, adj.y)) !== CellStatus.NO)
                        .map(adj => this.kb.key(adj.x, adj.y));
                });

                let intersection = candidateSets[0];
                for (let i = 1; i < candidateSets.length; i++) {
                    intersection = intersection.filter(k => candidateSets[i].includes(k));
                }

                if (intersection.length === 1) {
                    const exactW = this.kb.parseKey(intersection[0]);
                    this.kb.setConfirmedWumpus(exactW.x, exactW.y);
                    reasoningStep.appliedRules.push(RULES.find(r => r.id === 'R6_SINGLE_WUMPUS'));
                    reasoningStep.deductions.push(`[Regla 6 - Intersección] WUMPUS ubicado por intersección de hedores en (${exactW.x}, ${exactW.y}).`);
                    reasoningStep.newDangerCells.push(exactW);
                }
            }
        }

        // Propagación de Brisas pasadas: Si una brisa pasada ahora solo tiene 1 casilla no descartada
        for (const [k, p] of this.kb.perceptions.entries()) {
            if (p.breeze) {
                const bPos = this.kb.parseKey(k);
                const bAdj = this.kb.getAdjacent(bPos.x, bPos.y);
                const unknownCandidates = bAdj.filter(adj => 
                    this.kb.pitStatus.get(this.kb.key(adj.x, adj.y)) !== CellStatus.NO
                );

                if (unknownCandidates.length === 1) {
                    const confirmedPit = unknownCandidates[0];
                    const pitKey = this.kb.key(confirmedPit.x, confirmedPit.y);
                    if (this.kb.pitStatus.get(pitKey) !== CellStatus.KNOWN_YES) {
                        this.kb.setConfirmedPit(confirmedPit.x, confirmedPit.y);
                        reasoningStep.appliedRules.push(RULES.find(r => r.id === 'R7_PIT_RESOLUTION'));
                        reasoningStep.deductions.push(`[Regla 7 - Retro-Resolución] La brisa previa en (${bPos.x}, ${bPos.y}) confirma HOYO en (${confirmedPit.x}, ${confirmedPit.y}).`);
                        reasoningStep.newDangerCells.push(confirmedPit);
                    }
                }
            }
        }
    }
}
