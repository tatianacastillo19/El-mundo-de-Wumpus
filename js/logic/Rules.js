/**
 * Reglas Lógicas de Inferencia para el Mundo de Wumpus
 * 
 * Basadas en la lógica proposicional estándar (Russell & Norvig - AIMA).
 * Cada regla tiene su fórmula formal, descripción en lenguaje natural y función evaluadora.
 */

export const RULES = [
    {
        id: 'R1_NO_BREEZE',
        name: 'Regla 1: Ausencia de Brisa',
        formula: '¬B(x, y) ⇒ ⋀(¬P(x\', y\')) para todo (x\', y\') ∈ Adyacentes(x, y)',
        description: 'Si NO hay brisa en la casilla actual, ninguna de las casillas adyacentes contiene un hoyo.',
        category: 'Seguridad'
    },
    {
        id: 'R2_BREEZE_DISJUNCTION',
        name: 'Regla 2: Presencia de Brisa (Disyunción)',
        formula: 'B(x, y) ⇔ ⋁(P(x\', y\')) para todo (x\', y\') ∈ Adyacentes(x, y)',
        description: 'Si hay brisa en la casilla actual, al menos una de las casillas adyacentes contiene un hoyo.',
        category: 'Incertidumbre'
    },
    {
        id: 'R3_NO_STENCH',
        name: 'Regla 3: Ausencia de Hedor',
        formula: '¬S(x, y) ⇒ ⋀(¬W(x\', y\')) para todo (x\', y\') ∈ Adyacentes(x, y)',
        description: 'Si NO hay hedor en la casilla actual, ninguna de las casillas adyacentes contiene al Wumpus.',
        category: 'Seguridad'
    },
    {
        id: 'R4_STENCH_DISJUNCTION',
        name: 'Regla 4: Presencia de Hedor (Disyunción)',
        formula: 'S(x, y) ⇔ ⋁(W(x\', y\')) para todo (x\', y\') ∈ Adyacentes(x, y)',
        description: 'Si hay hedor en la casilla actual, al menos una de las casillas adyacentes contiene al Wumpus.',
        category: 'Incertidumbre'
    },
    {
        id: 'R5_SAFE_CELL',
        name: 'Regla 5: Casilla Segura (OK)',
        formula: 'OK(x, y) ⇔ (¬P(x, y) ∧ ¬W(x, y))',
        description: 'Una casilla se concluye como 100% segura (OK) si y solo si se ha probado formalmente que NO tiene hoyo y NO tiene Wumpus.',
        category: 'Deducción de Seguridad'
    },
    {
        id: 'R6_SINGLE_WUMPUS',
        name: 'Regla 6: Wumpus Único (Intersección)',
        formula: '∃!(x, y) [ W(x, y) ] ∧ (S(a,b) ∧ S(c,d)) ⇒ W(x,y) ∈ (Adj(a,b) ∩ Adj(c,d))',
        description: 'Existe exactamente un Wumpus en el mundo. Si hay hedor en dos casillas diferentes, el Wumpus debe estar en la intersección de sus adyacentes.',
        category: 'Deducción Exacta'
    },
    {
        id: 'R7_PIT_RESOLUTION',
        name: 'Regla 7: Resolución de Hoyo Único',
        formula: 'B(x, y) ∧ (⋀_{i≠k} ¬P(adj_i)) ⇒ P(adj_k)',
        description: 'Si hay brisa en (x,y) y todas las casillas adyacentes excepto una ya demostraron NO tener hoyo, entonces esa casilla restante TIENE un hoyo con certeza.',
        category: 'Deducción Exacta'
    },
    {
        id: 'R8_GLITTER_GOLD',
        name: 'Regla 8: Detección de Oro',
        formula: 'Glitter(x, y) ⇒ Gold(x, y)',
        description: 'Si el agente percibe brillo en la casilla actual, el oro se encuentra en esta misma casilla. Acción inmediata: Tomar Oro.',
        category: 'Meta'
    },
    {
        id: 'R9_DEAD_WUMPUS',
        name: 'Regla 9: Wumpus Eliminado',
        formula: 'Scream ⇒ ∀(x, y) [ ¬W(x, y) ]',
        description: 'Si se escucha el grito del Wumpus, el Wumpus ha muerto y todas las casillas quedan libres de la amenaza del Wumpus.',
        category: 'Estado Global'
    }
];
