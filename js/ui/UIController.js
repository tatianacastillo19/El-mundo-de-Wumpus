/**
 * UIController: Controlador de Interfaz Gráfica y Visualización Pedagógica
 * 
 * Gestiona el renderizado del tablero, la animación del agente, los paneles de
 * razonamiento lógico en tiempo real, el visor de la Base de Conocimiento y los controles.
 */

import { CellStatus } from '../logic/KnowledgeBase.js';
import { RULES } from '../logic/Rules.js';
import { AgentStatus } from '../agent/Agent.js';

export class UIController {
    constructor(world, agent) {
        this.world = world;
        this.agent = agent;

        this.godMode = false;
        this.autoRunning = false;
        this.autoTimer = null;
        this.stepDelay = 700; // ms

        this.initDOM();
        this.bindEvents();
        this.renderRulesCatalog();
        this.updateUI();
    }

    initDOM() {
        // Tablero y contenedores
        this.gridBoard = document.getElementById('gridBoard');
        
        // Paneles de contenido
        this.reasoningPanel = document.getElementById('reasoningPanelContent');
        this.kbSummaryPanel = document.getElementById('kbSummaryPanel');
        this.rulesPanel = document.getElementById('rulesPanelContent');
        this.historyTimeline = document.getElementById('historyTimeline');

        // Stats del header
        this.statScore = document.getElementById('statScore');
        this.statStep = document.getElementById('statStep');
        this.statGold = document.getElementById('statGold');
        this.statArrow = document.getElementById('statArrow');
        this.statWumpus = document.getElementById('statWumpus');
        this.statStatus = document.getElementById('statStatus');

        // Botones de control
        this.btnAuto = document.getElementById('btnAuto');
        this.btnStep = document.getElementById('btnStep');
        this.btnReset = document.getElementById('btnReset');
        this.btnNewRandom = document.getElementById('btnNewRandom');
        this.presetSelect = document.getElementById('presetSelect');
        this.chkGodMode = document.getElementById('chkGodMode');
        this.speedSlider = document.getElementById('speedSlider');

        // Tabs
        this.tabButtons = document.querySelectorAll('.tab-btn');
        this.tabPanes = document.querySelectorAll('.tab-pane');

        // Modal
        this.modal = document.getElementById('gameModal');
        this.modalIcon = document.getElementById('modalIcon');
        this.modalTitle = document.getElementById('modalTitle');
        this.modalDesc = document.getElementById('modalDesc');
        this.modalScore = document.getElementById('modalScore');
        this.modalSteps = document.getElementById('modalSteps');
        this.modalCloseBtn = document.getElementById('modalCloseBtn');
    }

    bindEvents() {
        // Control de Ejecución
        this.btnAuto.addEventListener('click', () => this.toggleAutoRun());
        this.btnStep.addEventListener('click', () => this.stepOnce());
        this.btnReset.addEventListener('click', () => this.resetSimulation());
        this.btnNewRandom.addEventListener('click', () => {
            this.presetSelect.value = 'random';
            this.loadPreset('random');
        });

        // Selector de mapas / escenarios
        this.presetSelect.addEventListener('change', (e) => {
            this.loadPreset(e.target.value);
        });

        // Toggles
        this.chkGodMode.addEventListener('change', (e) => {
            this.godMode = e.target.checked;
            this.renderBoard();
        });

        this.speedSlider.addEventListener('input', (e) => {
            // Slider value 1 (lento) a 10 (rápido) -> 1500ms a 200ms
            const val = Number(e.target.value);
            this.stepDelay = Math.max(150, 1600 - (val * 140));
            if (this.autoRunning) {
                this.restartAutoTimer();
            }
        });

        // Tabs switching
        this.tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                this.switchTab(targetTab);
            });
        });

        // Modal close
        this.modalCloseBtn.addEventListener('click', () => {
            this.modal.classList.remove('open');
        });
    }

    switchTab(tabId) {
        this.tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        this.tabPanes.forEach(pane => {
            pane.classList.toggle('active', pane.id === tabId);
        });
    }

    loadPreset(presetName) {
        this.stopAutoRun();
        if (presetName === 'classic') {
            this.world.loadPresetClassic();
        } else if (presetName === 'random') {
            this.world.generateRandom();
        }
        this.agent.reset(1, 1, this.world.width, this.world.height);
        this.updateUI();
    }

    resetSimulation() {
        this.stopAutoRun();
        const currentPreset = this.presetSelect.value;
        if (currentPreset === 'classic') {
            this.world.loadPresetClassic();
        }
        // En mapa aleatorio o fijo, vuelve a colocar al agente al inicio (1,1) con la KB limpia
        this.agent.reset(1, 1, this.world.width, this.world.height);
        this.updateUI();
    }

    toggleAutoRun() {
        if (this.autoRunning) {
            this.stopAutoRun();
        } else {
            this.startAutoRun();
        }
    }

    startAutoRun() {
        if (!this.agent.isAlive || this.agent.hasClimbed || this.agent.status === AgentStatus.WON) {
            this.resetSimulation();
        }
        this.autoRunning = true;
        this.btnAuto.innerHTML = `<span>⏸</span> Pausar`;
        this.btnAuto.classList.add('is-running');
        this.btnStep.disabled = true;

        this.autoTimer = setInterval(() => {
            const hasMore = this.stepOnce();
            if (!hasMore) {
                this.stopAutoRun();
            }
        }, this.stepDelay);
    }

    stopAutoRun() {
        this.autoRunning = false;
        clearInterval(this.autoTimer);
        this.autoTimer = null;
        this.btnAuto.innerHTML = `<span>▶</span> Ejecutar Agente`;
        this.btnAuto.classList.remove('is-running');
        this.btnStep.disabled = false;
    }

    restartAutoTimer() {
        clearInterval(this.autoTimer);
        if (this.autoRunning) {
            this.autoTimer = setInterval(() => {
                const hasMore = this.stepOnce();
                if (!hasMore) {
                    this.stopAutoRun();
                }
            }, this.stepDelay);
        }
    }

    stepOnce() {
        if (!this.agent.isAlive || this.agent.hasClimbed || this.agent.status === AgentStatus.WON) {
            return false;
        }

        const stepRecord = this.agent.executeStep(this.world);
        if (!stepRecord) return false;

        this.updateUI(stepRecord);

        // Verificar fin de partida
        if (!this.agent.isAlive || this.agent.hasClimbed || this.agent.status === AgentStatus.WON) {
            setTimeout(() => this.showEndGameModal(), 500);
            return false;
        }

        return true;
    }

    updateUI(lastStep = null) {
        this.renderBoard();
        this.renderStats();
        this.renderReasoningPanel(lastStep);
        this.renderKBSummary();
        this.renderHistoryTimeline();
    }

    /**
     * Renderiza el tablero 4x4 respetando el sistema de coordenadas de Russell & Norvig:
     * Filas Y van de 4 (arriba) a 1 (abajo).
     * Columnas X van de 1 (izquierda) a 4 (derecha).
     * (1,1) está en la esquina inferior izquierda.
     */
    renderBoard() {
        this.gridBoard.innerHTML = '';

        for (let y = this.world.height; y >= 1; y--) {
            for (let x = 1; x <= this.world.width; x++) {
                const cellElem = document.createElement('div');
                cellElem.className = 'grid-cell';
                cellElem.dataset.coord = `${x},${y}`;

                const isAgentHere = this.agent.x === x && this.agent.y === y;
                const cellKey = `${x},${y}`;
                const isVisited = this.agent.kb.visited.has(cellKey);
                const isSafe = this.agent.kb.safeCells.has(cellKey);
                const pitStatus = this.agent.kb.pitStatus.get(cellKey);
                const wumpusStatus = this.agent.kb.wumpusStatus.get(cellKey);
                const isRealPit = this.world.pits.has(cellKey);
                const isRealWumpus = this.world.wumpusPos && this.world.wumpusPos.x === x && this.world.wumpusPos.y === y;
                const isRealGold = this.world.goldPos && this.world.goldPos.x === x && this.world.goldPos.y === y && !this.world.goldCollected;

                // Clases de estado lógico inferido
                if (isVisited) cellElem.classList.add('visited');
                else cellElem.classList.add('unvisited');

                if (isSafe) cellElem.classList.add('safe');
                if (pitStatus === CellStatus.POSSIBLE) cellElem.classList.add('possible-pit');
                if (pitStatus === CellStatus.KNOWN_YES) cellElem.classList.add('confirmed-pit');
                if (wumpusStatus === CellStatus.POSSIBLE) cellElem.classList.add('possible-wumpus');
                if (wumpusStatus === CellStatus.KNOWN_YES) cellElem.classList.add('confirmed-wumpus');
                if (isAgentHere) cellElem.classList.add('has-agent');

                // Encabezado de celda (Coordenadas y Badges de conocimiento)
                const header = document.createElement('div');
                header.className = 'cell-header';
                
                const coordLabel = document.createElement('span');
                coordLabel.className = 'cell-coord';
                coordLabel.textContent = `(${x},${y})`;
                header.appendChild(coordLabel);

                const badgesDiv = document.createElement('div');
                badgesDiv.className = 'cell-badges';

                if (isSafe && !isVisited) {
                    const b = document.createElement('span');
                    b.className = 'badge-kb badge-safe';
                    b.textContent = 'OK';
                    b.title = 'Casilla probada segura por inferencia lógica';
                    badgesDiv.appendChild(b);
                }

                if (pitStatus === CellStatus.POSSIBLE) {
                    const b = document.createElement('span');
                    b.className = 'badge-kb badge-danger';
                    b.textContent = 'P?';
                    b.title = 'Posible hoyo deducido por brisa';
                    badgesDiv.appendChild(b);
                } else if (pitStatus === CellStatus.KNOWN_YES) {
                    const b = document.createElement('span');
                    b.className = 'badge-kb badge-danger';
                    b.textContent = 'HOYO';
                    b.title = 'Hoyo confirmado con certeza';
                    badgesDiv.appendChild(b);
                }

                if (wumpusStatus === CellStatus.POSSIBLE) {
                    const b = document.createElement('span');
                    b.className = 'badge-kb badge-wumpus';
                    b.textContent = 'W?';
                    b.title = 'Posible Wumpus deducido por hedor';
                    badgesDiv.appendChild(b);
                } else if (wumpusStatus === CellStatus.KNOWN_YES) {
                    const b = document.createElement('span');
                    b.className = 'badge-kb badge-wumpus';
                    b.textContent = 'WUMPUS';
                    b.title = 'Wumpus localizado con certeza';
                    badgesDiv.appendChild(b);
                }

                header.appendChild(badgesDiv);
                cellElem.appendChild(header);

                // Cuerpo de celda (Entidades del mundo y Agente)
                const body = document.createElement('div');
                body.className = 'cell-body';

                if (isAgentHere) {
                    const agentSprite = document.createElement('div');
                    agentSprite.className = 'agent-sprite';
                    
                    const avatar = document.createElement('div');
                    avatar.className = 'agent-avatar';
                    avatar.textContent = this.agent.isAlive ? '🤠' : '💀';
                    
                    const dirArrow = document.createElement('div');
                    dirArrow.className = 'agent-dir-arrow';
                    const arrows = { 'ARRIBA': '▲ ARRIBA', 'DERECHA': '▶ DERECHA', 'ABAJO': '▼ ABAJO', 'IZQUIERDA': '◀ IZQUIERDA' };
                    dirArrow.textContent = arrows[this.agent.orientation] || '▶';

                    agentSprite.appendChild(avatar);
                    agentSprite.appendChild(dirArrow);
                    body.appendChild(agentSprite);

                    // En Modo Dios, si el agente está sobre el oro, mostrar mini etiqueta
                    if (this.godMode && isRealGold) {
                        const miniGold = document.createElement('span');
                        miniGold.className = 'entity-text entity-oro';
                        miniGold.style.cssText = 'position: absolute; bottom: 0; right: 0; font-size: 0.65rem; padding: 1px 3px;';
                        miniGold.textContent = 'ORO';
                        body.appendChild(miniGold);
                    }
                } else if (isVisited || this.godMode) {
                    // Si ya fue visitada o estamos en modo Dios, mostrar objetos reales en texto
                    if (isRealPit) {
                        const pitText = document.createElement('div');
                        pitText.className = 'entity-text entity-hoyo';
                        pitText.textContent = 'HOYO';
                        if (!isVisited && this.godMode) pitText.style.opacity = '0.7';
                        body.appendChild(pitText);
                    } else if (isRealWumpus) {
                        const wumpusText = document.createElement('div');
                        wumpusText.className = 'entity-text entity-wumpus';
                        wumpusText.textContent = this.world.wumpusAlive ? 'WUMPUS' : 'WUMPUS (X)';
                        if (!isVisited && this.godMode) wumpusText.style.opacity = '0.7';
                        body.appendChild(wumpusText);
                    } else if (isRealGold) {
                        const goldText = document.createElement('div');
                        goldText.className = 'entity-text entity-oro';
                        goldText.textContent = 'ORO';
                        if (!isVisited && this.godMode) goldText.style.opacity = '0.7';
                        body.appendChild(goldText);
                    }
                }

                cellElem.appendChild(body);

                // Percepciones en casillas visitadas o en Modo Dios (como etiquetas de texto)
                const perceptsDiv = document.createElement('div');
                perceptsDiv.className = 'cell-percepts';

                const realPerception = (isVisited || this.godMode) ? this.world.getPerception(x, y) : null;

                if (isVisited) {
                    const p = this.agent.kb.perceptions.get(cellKey);
                    if (p) {
                        if (p.breeze) {
                            const tag = document.createElement('span');
                            tag.className = 'percept-tag percept-brisa';
                            tag.textContent = 'BRISA';
                            perceptsDiv.appendChild(tag);
                        }
                        if (p.stench) {
                            const tag = document.createElement('span');
                            tag.className = 'percept-tag percept-hedor';
                            tag.textContent = 'HEDOR';
                            perceptsDiv.appendChild(tag);
                        }
                        if (p.glitter) {
                            const tag = document.createElement('span');
                            tag.className = 'percept-tag percept-brillo';
                            tag.textContent = 'BRILLO';
                            perceptsDiv.appendChild(tag);
                        }
                        if (!p.breeze && !p.stench && !p.glitter) {
                            const tag = document.createElement('span');
                            tag.className = 'percept-tag percept-limpio';
                            tag.textContent = 'LIMPIO';
                            perceptsDiv.appendChild(tag);
                        }
                    }
                } else if (this.godMode && realPerception) {
                    // En Modo Dios para casillas no visitadas aún
                    if (realPerception.breeze) {
                        const tag = document.createElement('span');
                        tag.className = 'percept-tag percept-brisa';
                        tag.style.opacity = '0.6';
                        tag.textContent = 'BRISA';
                        perceptsDiv.appendChild(tag);
                    }
                    if (realPerception.stench) {
                        const tag = document.createElement('span');
                        tag.className = 'percept-tag percept-hedor';
                        tag.style.opacity = '0.6';
                        tag.textContent = 'HEDOR';
                        perceptsDiv.appendChild(tag);
                    }
                }
                cellElem.appendChild(perceptsDiv);

                // Capa de Niebla de Guerra (Fog of War)
                const fog = document.createElement('div');
                fog.className = 'cell-fog';
                if (isVisited || this.godMode) {
                    fog.classList.add('revealed');
                } else {
                    const fogLabel = document.createElement('span');
                    fogLabel.className = 'cell-fog-label';
                    fogLabel.textContent = 'OCULTO';
                    fog.appendChild(fogLabel);
                }
                cellElem.appendChild(fog);

                this.gridBoard.appendChild(cellElem);
            }
        }
    }

    renderStats() {
        this.statScore.textContent = this.agent.score;
        this.statStep.textContent = this.agent.stepCount;
        this.statGold.textContent = this.agent.hasGold ? 'Obtenido' : 'No';
        this.statArrow.textContent = this.agent.hasArrow ? 'Disponible' : 'Agotada';
        this.statWumpus.textContent = this.world.wumpusAlive ? 'Vivo' : 'Muerto';
        
        let statusText = 'Listo';
        if (this.agent.status === AgentStatus.EXPLORING) statusText = 'Explorando';
        else if (this.agent.status === AgentStatus.WON) statusText = 'Victoria';
        else if (this.agent.status === AgentStatus.DEAD_PIT) statusText = 'Derrota (Hoyo)';
        else if (this.agent.status === AgentStatus.DEAD_WUMPUS) statusText = 'Derrota (Wumpus)';
        else if (this.agent.status === AgentStatus.CLIMBED) statusText = 'Salida de Caverna';
        this.statStatus.textContent = statusText;
    }

    /**
     * Renderiza el Panel de Razonamiento en Tiempo Real
     * Muestra de forma impecable el ciclo:
     * PERCEPCIÓN → BASE DE CONOCIMIENTO → INFERENCIA → DECISIÓN → ACCIÓN
     */
    renderReasoningPanel(step) {
        if (!step) {
            this.reasoningPanel.innerHTML = `
                <div class="reasoning-card">
                    <div class="card-header-badge">
                        <span>Estado Inicial del Agente</span>
                        <span>Listo</span>
                    </div>
                    <p class="card-content-text">
                        El agente se encuentra en la entrada <strong>(1, 1)</strong> sin conocimiento previo del entorno. 
                        Presiona <strong>"Paso a Paso"</strong> o <strong>"Ejecutar Agente"</strong> para observar cómo percibe estímulos, actualiza la Base de Conocimiento, aplica reglas lógicas y toma decisiones racionales.
                    </p>
                </div>
            `;
            return;
        }

        const { positionBefore, perception, inference, decision, actionResult } = step;

        const pList = perception.toTextArray().map(p => `<strong>${p.label}</strong>: ${p.desc}`).join('<br>');
        
        let deductionsHtml = '';
        if (inference.deductions && inference.deductions.length > 0) {
            deductionsHtml = `
                <div class="inference-list">
                    ${inference.deductions.map(d => `<div class="inference-item">${d}</div>`).join('')}
                </div>
            `;
        } else {
            deductionsHtml = `<div class="card-content-text text-dim">No se generaron deducciones nuevas en este paso.</div>`;
        }

        let rulesHtml = '';
        if (inference.appliedRules && inference.appliedRules.length > 0) {
            rulesHtml = `
                <div style="margin-top: 6px;">
                    ${inference.appliedRules.map(r => `
                        <div class="formula-tag" title="${r.description}">
                            <strong>${r.name}</strong>: ${r.formula}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        this.reasoningPanel.innerHTML = `
            <div class="reasoning-cycle-wrapper">
                <!-- 1. PERCEPCIÓN -->
                <div class="reasoning-card card-perception">
                    <div class="card-header-badge">
                        <span>1. Percepción Sensorial en (${positionBefore.x}, ${positionBefore.y})</span>
                        <span>Fase 1</span>
                    </div>
                    <div class="card-content-text">
                        ${pList}
                    </div>
                </div>

                <!-- 2. ACTUALIZACIÓN KB -->
                <div class="reasoning-card card-kb">
                    <div class="card-header-badge">
                        <span>2. Actualización de Base de Conocimiento</span>
                        <span>Fase 2</span>
                    </div>
                    <div class="card-content-text">
                        Se incorpora el axioma de visita <code>Visited(${positionBefore.x}, ${positionBefore.y})</code> y las lecturas sensoriales a la KB.
                    </div>
                </div>

                <!-- 3. INFERENCIA LÓGICA -->
                <div class="reasoning-card card-inference">
                    <div class="card-header-badge">
                        <span>3. Inferencia Lógica y Reglas</span>
                        <span>Fase 3</span>
                    </div>
                    ${rulesHtml}
                    ${deductionsHtml}
                </div>

                <!-- 4. DECISIÓN RACIONAL -->
                <div class="reasoning-card card-decision">
                    <div class="card-header-badge">
                        <span>4. Decisión Racional</span>
                        <span>Fase 4</span>
                    </div>
                    <div class="card-content-text">
                        ${decision.rationale}
                    </div>
                </div>

                <!-- 5. ACCIÓN EJECUTADA -->
                <div class="reasoning-card card-action">
                    <div class="card-header-badge">
                        <span>5. Acción Ejecutada</span>
                        <span>${decision.action}</span>
                    </div>
                    <div class="card-content-text">
                        <strong>${actionResult.message}</strong>
                    </div>
                </div>
            </div>
        `;
    }

    renderKBSummary() {
        const summary = this.agent.kb.getSummary();

        const renderChipList = (items, className, emptyMsg = 'Ninguna') => {
            if (!items || items.length === 0) {
                return `<span class="kb-empty">${emptyMsg}</span>`;
            }
            return items.map(it => `<span class="kb-chip ${className}">(${it})</span>`).join('');
        };

        this.kbSummaryPanel.innerHTML = `
            <div class="kb-section-grid">
                <div class="kb-box">
                    <div class="kb-box-title">Casillas Seguras (OK)</div>
                    <div class="kb-chips-list">
                        ${renderChipList(summary.safe, 'safe')}
                    </div>
                </div>

                <div class="kb-box">
                    <div class="kb-box-title">Casillas Visitadas</div>
                    <div class="kb-chips-list">
                        ${renderChipList(summary.visited, 'visited')}
                    </div>
                </div>

                <div class="kb-box">
                    <div class="kb-box-title">Posibles Hoyos (P?)</div>
                    <div class="kb-chips-list">
                        ${renderChipList(summary.possiblePits, 'pit', 'Sin sospechas')}
                    </div>
                </div>

                <div class="kb-box">
                    <div class="kb-box-title">Hoyos Confirmados</div>
                    <div class="kb-chips-list">
                        ${renderChipList(summary.confirmedPits, 'pit', 'Ninguno confirmado')}
                    </div>
                </div>

                <div class="kb-box">
                    <div class="kb-box-title">Posible Wumpus (W?)</div>
                    <div class="kb-chips-list">
                        ${summary.wumpusDead ? '<span class="kb-chip safe">Wumpus Muerto</span>' : renderChipList(summary.possibleWumpus, 'wumpus', 'Sin hedor detectado')}
                    </div>
                </div>

                <div class="kb-box">
                    <div class="kb-box-title">Ubicación Exacta Wumpus</div>
                    <div class="kb-chips-list">
                        ${summary.wumpusDead ? '<span class="kb-chip safe">Eliminado</span>' : (summary.exactWumpus ? `<span class="kb-chip wumpus">${summary.exactWumpus}</span>` : '<span class="kb-empty">Aún no deducida</span>')}
                    </div>
                </div>
            </div>
        `;
    }

    renderRulesCatalog() {
        this.rulesPanel.innerHTML = `
            <div class="rules-catalog">
                ${RULES.map(rule => `
                    <div class="rule-card">
                        <div class="rule-header">
                            <span class="rule-name">${rule.name}</span>
                            <span class="rule-category">${rule.category}</span>
                        </div>
                        <div class="rule-formula">${rule.formula}</div>
                        <div class="rule-desc">${rule.description}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderHistoryTimeline() {
        if (!this.agent.history || this.agent.history.length === 0) {
            this.historyTimeline.innerHTML = `<div class="card-content-text text-dim">No hay historial de pasos aún.</div>`;
            return;
        }

        const reversed = [...this.agent.history].reverse();
        this.historyTimeline.innerHTML = reversed.map(step => `
            <div class="history-item">
                <div class="history-header">
                    <span>Paso #${step.stepNumber} - Desde (${step.positionBefore.x}, ${step.positionBefore.y})</span>
                    <span class="history-action-badge">${step.decision.action}</span>
                </div>
                <div>${step.actionResult.message}</div>
                <div style="font-size: 0.72rem; color: var(--text-dim); font-family: var(--font-code);">
                    Puntaje: ${step.score} pts | Percepción: ${step.perception.toString()}
                </div>
            </div>
        `).join('');
    }

    showEndGameModal() {
        let title = 'Misión Cumplida';
        let desc = 'El agente completó su razonamiento lógico.';

        if (this.agent.status === AgentStatus.WON) {
            title = 'VICTORIA TOTAL';
            desc = 'El agente lógico encontró el Oro, evitó todos los peligros mediante razonamiento deductivo y salió seguro de la caverna.';
        } else if (this.agent.status === AgentStatus.DEAD_PIT) {
            title = 'Derrota: Caída en Hoyo';
            desc = 'El agente se adentró en una casilla con hoyo al agotar las opciones 100% seguras.';
        } else if (this.agent.status === AgentStatus.DEAD_WUMPUS) {
            title = 'Derrota: Ataque de Wumpus';
            desc = 'El agente ingresó en la casilla del Wumpus.';
        } else if (this.agent.status === AgentStatus.CLIMBED) {
            title = 'Salida de la Caverna';
            desc = 'El agente decidió salir de la caverna para preservar su vida al no encontrar más caminos seguros.';
        }

        if (this.modalIcon) this.modalIcon.style.display = 'none';
        this.modalTitle.textContent = title;
        this.modalDesc.textContent = desc;
        this.modalScore.textContent = `${this.agent.score} pts`;
        this.modalSteps.textContent = this.agent.stepCount;

        this.modal.classList.add('open');
    }
}
