/**
 * Agente Lógico del Mundo de Wumpus
 * 
 * Gestiona el ciclo completo:
 * PERCEPCIÓN → BASE DE CONOCIMIENTO → INFERENCIA → DECISIÓN → ACCIÓN
 */

import { KnowledgeBase } from '../logic/KnowledgeBase.js';
import { InferenceEngine } from '../logic/InferenceEngine.js';
import { DecisionMaker, Actions } from '../logic/DecisionMaker.js';

export const AgentStatus = {
    READY: 'LISTO',
    EXPLORING: 'EXPLORANDO',
    WON: 'VICTORIA',
    DEAD_PIT: 'MUERTO_HOYO',
    DEAD_WUMPUS: 'MUERTO_WUMPUS',
    CLIMBED: 'SALIDA_EXITOSA'
};

export class Agent {
    constructor(startX = 1, startY = 1, worldWidth = 4, worldHeight = 4) {
        this.x = startX;
        this.y = startY;
        this.orientation = 'DERECHA'; // ARRIBA, DERECHA, ABAJO, IZQUIERDA
        this.hasGold = false;
        this.hasArrow = true;
        this.isAlive = true;
        this.hasClimbed = false;
        this.score = 0;
        this.stepCount = 0;
        this.status = AgentStatus.READY;

        // Módulos lógicos
        this.kb = new KnowledgeBase(worldWidth, worldHeight);
        this.inferenceEngine = new InferenceEngine(this.kb);
        this.decisionMaker = new DecisionMaker(this.kb);

        // Historial de pasos ejecutados
        this.history = [];
    }

    /**
     * Reinicia el agente a su estado inicial
     */
    reset(startX = 1, startY = 1, worldWidth = 4, worldHeight = 4) {
        this.x = startX;
        this.y = startY;
        this.orientation = 'DERECHA';
        this.hasGold = false;
        this.hasArrow = true;
        this.isAlive = true;
        this.hasClimbed = false;
        this.score = 0;
        this.stepCount = 0;
        this.status = AgentStatus.READY;

        this.kb = new KnowledgeBase(worldWidth, worldHeight);
        this.inferenceEngine = new InferenceEngine(this.kb);
        this.decisionMaker = new DecisionMaker(this.kb);
        this.history = [];
    }

    /**
     * Ejecuta UN ciclo completo del agente:
     * 1. PERCEPCIÓN
     * 2. ACTUALIZACIÓN DE KB
     * 3. INFERENCIA LÓGICA
     * 4. DECISIÓN RACIONAL
     * 5. ACCIÓN Y EFECTO EN EL ENTORNO
     * 
     * @param {GridWorld} world - El entorno del juego
     * @returns {Object} Reporte pedagógico detallado del paso
     */
    executeStep(world) {
        if (!this.isAlive || this.hasClimbed || this.status === AgentStatus.WON) {
            return null;
        }

        this.status = AgentStatus.EXPLORING;
        this.stepCount++;

        // Guardar la posición exacta antes de ejecutar la acción física
        const startX = this.x;
        const startY = this.y;

        // -------------------------------------------------------------
        // FASE 1: PERCEPCIÓN
        // -------------------------------------------------------------
        const perception = world.getPerception(startX, startY);

        // -------------------------------------------------------------
        // FASE 2: ACTUALIZACIÓN DE BASE DE CONOCIMIENTO (Registro de visita)
        // -------------------------------------------------------------
        this.kb.recordVisit(startX, startY, perception);

        // -------------------------------------------------------------
        // FASE 3: INFERENCIA LÓGICA (Deducción formal)
        // -------------------------------------------------------------
        const inferenceResult = this.inferenceEngine.infer(startX, startY, perception);

        // -------------------------------------------------------------
        // FASE 4: DECISIÓN RACIONAL
        // -------------------------------------------------------------
        const decision = this.decisionMaker.decide({
            x: startX,
            y: startY,
            hasGold: this.hasGold,
            hasArrow: this.hasArrow,
            orientation: this.orientation,
            score: this.score,
            isAlive: this.isAlive
        }, perception);

        // -------------------------------------------------------------
        // FASE 5: ACCIÓN Y EFECTO EN EL ENTORNO
        // -------------------------------------------------------------
        const actionResult = this.performAction(decision.action, world);

        if (actionResult.shotResult) {
            if (actionResult.shotResult.hit) {
                perception.scream = world.getPerception(startX, startY).scream;
            }
            this.kb.recordVisit(startX, startY, perception);
            const shotInference = this.inferenceEngine.infer(
                startX,
                startY,
                perception,
                actionResult.shotResult
            );
            inferenceResult.appliedRules = Array.from(new Set([
                ...inferenceResult.appliedRules,
                ...shotInference.appliedRules
            ]));
            inferenceResult.deductions.push(...shotInference.deductions);
            inferenceResult.newSafeCells.push(...shotInference.newSafeCells);
            inferenceResult.newDangerCells.push(...shotInference.newDangerCells);
        }

        // El disparo cuesta 10 puntos en total; otras acciones cuestan 1.
        if (!actionResult.shotResult) this.score -= 1;
        world.consumeScream();

        const stepRecord = {
            stepNumber: this.stepCount,
            positionBefore: { x: startX, y: startY },
            perception: perception,
            inference: inferenceResult,
            decision: decision,
            actionResult: actionResult,
            positionAfter: { x: this.x, y: this.y },
            score: this.score,
            status: this.status,
            kbSummary: this.kb.getSummary()
        };

        this.history.push(stepRecord);
        return stepRecord;
    }

    /**
     * Aplica físicamente la acción seleccionada al mundo y actualiza el estado del agente
     */
    performAction(action, world) {
        let message = '';
        let soundCue = 'step';
        let shotResult = null;

        switch (action) {
            case Actions.MOVE_UP:
                this.orientation = 'ARRIBA';
                this.y += 1;
                message = `El agente se desplazó hacia ARRIBA a la casilla (${this.x}, ${this.y}).`;
                break;

            case Actions.MOVE_DOWN:
                this.orientation = 'ABAJO';
                this.y -= 1;
                message = `El agente se desplazó hacia ABAJO a la casilla (${this.x}, ${this.y}).`;
                break;

            case Actions.MOVE_LEFT:
                this.orientation = 'IZQUIERDA';
                this.x -= 1;
                message = `El agente se desplazó hacia la IZQUIERDA a la casilla (${this.x}, ${this.y}).`;
                break;

            case Actions.MOVE_RIGHT:
                this.orientation = 'DERECHA';
                this.x += 1;
                message = `El agente se desplazó hacia la DERECHA a la casilla (${this.x}, ${this.y}).`;
                break;

            case Actions.TURN_LEFT:
            case Actions.TURN_RIGHT: {
                const orientations = ['ARRIBA', 'DERECHA', 'ABAJO', 'IZQUIERDA'];
                const currentIndex = orientations.indexOf(this.orientation);
                const turn = action === Actions.TURN_RIGHT ? 1 : -1;
                this.orientation = orientations[(currentIndex + turn + orientations.length) % orientations.length];
                message = `El agente giró hacia ${this.orientation} sin cambiar de casilla.`;
                break;
            }

            case Actions.GRAB_GOLD:
                if (world.goldPos && world.goldPos.x === this.x && world.goldPos.y === this.y && !world.goldCollected) {
                    this.hasGold = true;
                    world.goldCollected = true;
                    this.score += 1000;
                    message = `El agente tomó el ORO en (${this.x}, ${this.y}) (+1000 pts).`;
                    soundCue = 'gold';
                }
                break;

            case Actions.SHOOT_UP:
            case Actions.SHOOT_DOWN:
            case Actions.SHOOT_LEFT:
            case Actions.SHOOT_RIGHT:
                if (!this.hasArrow) {
                    message = 'El agente ya no tiene flechas.';
                } else {
                    this.hasArrow = false;
                    this.score -= 10;
                    const direction = this.orientation;
                    const hit = world.shootArrow(this.x, this.y, direction);
                    shotResult = world.lastShotResult;
                    if (hit) {
                        message = `Flecha disparada hacia ${direction}. Se escucha un grito: ¡El Wumpus ha muerto!`;
                        soundCue = 'scream';
                    } else {
                        message = `Flecha disparada hacia ${direction}, pero no impactó al Wumpus.`;
                        soundCue = 'arrow_miss';
                    }
                }
                break;

            case Actions.SHOOT:
                if (!this.hasArrow) {
                    message = 'El agente ya no tiene flechas.';
                } else {
                    this.hasArrow = false;
                    this.score -= 10;
                    const direction = this.orientation;
                    const hit = world.shootArrow(this.x, this.y, direction);
                    shotResult = world.lastShotResult;
                    if (hit) {
                        message = `Flecha disparada hacia ${direction}. Se escucha un grito: ¡El Wumpus ha muerto!`;
                        soundCue = 'scream';
                    } else {
                        message = `Flecha disparada hacia ${direction}, pero no impactó al Wumpus.`;
                        soundCue = 'arrow_miss';
                    }
                }
                break;

            case Actions.CLIMB:
                if (this.x === 1 && this.y === 1) {
                    this.hasClimbed = true;
                    if (this.hasGold) {
                        this.status = AgentStatus.WON;
                        message = `VICTORIA TOTAL: El agente salió de la caverna con el ORO en mano.`;
                        soundCue = 'victory';
                    } else {
                        this.status = AgentStatus.CLIMBED;
                        message = `El agente salió de la caverna sin el oro para preservar su vida.`;
                        soundCue = 'exit';
                    }
                }
                break;
        }

        // =========================================================================
        // VERIFICACIÓN DE PELIGROS TRAS EL MOVIMIENTO (Hoyo o Wumpus Vivo)
        // =========================================================================
        const curKey = this.kb.key(this.x, this.y);
        if (world.pits.has(curKey)) {
            this.isAlive = false;
            this.status = AgentStatus.DEAD_PIT;
            this.score -= 1000;
            message += ` DERROTA: El agente cayó en un HOYO en (${this.x}, ${this.y}) (-1000 pts).`;
            soundCue = 'death_pit';
        } else if (world.wumpusAlive && world.wumpusPos && world.wumpusPos.x === this.x && world.wumpusPos.y === this.y) {
            this.isAlive = false;
            this.status = AgentStatus.DEAD_WUMPUS;
            this.score -= 1000;
            message += ` DERROTA: El agente fue devorado por el WUMPUS en (${this.x}, ${this.y}) (-1000 pts).`;
            soundCue = 'death_wumpus';
        }

        return {
            action,
            message,
            soundCue,
            shotResult,
            isAlive: this.isAlive,
            status: this.status
        };
    }
}

function GridWorld_key(x, y) {
    return `${x},${y}`;
}
