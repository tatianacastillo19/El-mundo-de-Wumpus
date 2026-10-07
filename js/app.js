/**
 * Punto de entrada principal (Application Bootstrap)
 * 
 * Instancia los modelos del mundo, el agente lógico, los efectos sonoros
 * y el controlador de la interfaz de usuario.
 */

import { GridWorld } from './models/GridWorld.js';
import { Agent } from './agent/Agent.js';
import { UIController } from './ui/UIController.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializar el Entorno (Mundo 4x4 con escenario clásico por defecto)
    const world = new GridWorld(4, 4);
    world.loadPresetClassic();

    // 2. Inicializar el Agente Lógico en (1, 1)
    const agent = new Agent(1, 1, 4, 4);

    // 3. Inicializar Controlador de UI
    const ui = new UIController(world, agent);

    console.log('Mundo de Wumpus inicializado con éxito.');
});
