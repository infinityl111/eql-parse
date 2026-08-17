# El divisor del dps: qué usamos hoy, y cuánto importa

Campeón ha visto en la aplicación del competidor que **el dps de un enemigo
muerto seguía bajando** mientras la pelea continuaba contra otro. Eso es un
divisor que sigue corriendo para alguien que ya paró. Antes de opinar de la suya,
lo nuestro — medido el **17 de agosto de 2026**, sin tocar una línea de código.

## 1 · Qué divisor usamos en cada sitio

Los tres números existen desde siempre y están guardados en cada fila
(`src/encounter.js:1183-1213`):

| campo | divisor | qué es |
|---|---|---|
| `dps` | **la pelea entera** (`inclusive`, `encounter.js:1201`) | daño ÷ duración de la pelea |
| `dpsOwn` | **la ventana del combatiente** (`own = last - first + 1`, `:1202`) | daño ÷ lo que él duró |
| `dpsActive` | **sus segundos activos**, menos los que no mandaba (`:1213`) | daño ÷ tiempo en que actuó |

Y esto es lo que enseña cada pantalla:

| dónde | qué pinta | divisor | fichero |
|---|---|---|---|
| **Lista de peleas** | `enemyDps` y `raidDps` | la pelea | `encounter.js:1264` · `ui/app.js:621-622` |
| **Reparto por combatiente**, número grande | `r.dps` | **la pelea** | `ui/app.js:964` |
| Reparto, línea de cifras | «ritmo» = `dpsActive`, sólo si difiere | sus segundos activos | `ui/app.js:979-980` |
| **Rótulo emergente** de la fila | `r.dps` | **la pelea** | `ui/app.js:2002` |
| Desglose de la fila | los **tres**, con su nombre | pelea / ventana / activos | `ui/app.js:1943-1945` |
| **Resumen del histórico**, tarjetas | `total ÷ segundos en combate` | agregado | `src/aggregate.js:217` |
| Resumen, filas | **daño y %**, no dps | — | `ui/app.js:4791+` |
| Resumen, fila de mascota plegada | `damage ÷ activeSec` | activos | `src/aggregate.js:279` |
| **Expediente del enemigo** | `damageTo ÷ e.seconds` | segundos de sus peleas | `src/foes.js:465` |
| **Gráfica** | daño por segundo, sin divisor | — | `ui/grafica.js` |

> **Tenemos el mismo fallo que él, en dos sitios: el número grande de cada fila y
> el rótulo emergente.** Los dos dividen por la pelea entera, así que a un
> enemigo que murió en el segundo 20 de una pelea de 200 le seguimos bajando la
> cifra durante 180 segundos en los que ya no existía.

Y hay una diferencia importante con el competidor: **nosotros ya calculamos las
tres**, y el desglose de la fila las enseña con su nombre. Lo que está mal no es
el cálculo — es **cuál sube al sitio donde se lee sin abrir nada**.

## 2 · Cuánto importa

Medido sobre el almacén entero: **1.687 peleas, 6.352 filas con daño**.

**A · Enemigos que mueren antes del final.** Cuánto sigue corriendo el divisor
después de su última acción, usando la hora de muerte guardada (`killTimes`):

| distancia entre su muerte y el final | muertes | |
|---|---:|---:|
| menos de 10 s | 1.861 | 37,3 % |
| 10 – 60 s | 1.608 | 32,3 % |
| más de 60 s | 1.515 | 30,4 % |
| **total** | **4.984** | |

**Casi dos de cada tres muertes (62,7 %) ocurren a más de diez segundos del
final.** No son cuatro peleas: es la mitad del histórico.

**B · Cualquier combatiente.** Segundos que el divisor corre fuera de su ventana
(`duración − ownSec`, que junta lo de antes de su primera acción y lo de después
de la última):

| fuera de su ventana | filas | |
|---|---:|---:|
| menos de 10 s | 4.421 | 69,6 % |
| 10 – 60 s | 1.333 | 21,0 % |
| más de 60 s | 598 | 9,4 % |

**775 de las 1.687 peleas (45,9 %) tienen al menos una fila con diez segundos o
más fuera de su ventana.**

**Y cuánto cambia la cifra** en esas 1.931 filas, comparando los dos divisores
(`dpsOwn ÷ dps`):

| mediana | p90 | p99 | máximo |
|---:|---:|---:|---:|
| **×2,04** | ×10,0 | ×63,4 | ×493 |

**La mitad de esas filas doblan su número** al cambiar de divisor.

### La salvedad del máximo, que hay que leer con el número

Los extremos son filas de **un segundo de ventana** en peleas larguísimas: un
combatiente que dio un golpe y se fue. Ahí `dps` da 0 y `dpsOwn` da 27, y ninguno
de los dos significa gran cosa — es el problema de la muestra de uno, el mismo
que ya obligó a quitar el «mín–máx» de la tabla de habilidades.

**Lo que sostiene la conclusión es la mediana ×2,04, no el ×493.** Y de paso
queda un aviso para el día del arreglo: **la ventana del combatiente necesita un
suelo o una forma de decir «esto es una muestra de un segundo»**, o cambiaremos
un número malo por otro.

## 3 · La regla, ya decidida, para cuando se arregle

Está escrita entera en
[ESTUDIO-COMPETIDORES.md §14.5](ESTUDIO-COMPETIDORES.md), regla 7, junto a las
otras del dps. En corto:

- **La TASA** se divide por **la ventana del combatiente**, y el tiempo sin mando
  sigue fuera. La muerte es el mismo caso que el encanto, sólo que permanente.
- **La APORTACIÓN** —«hizo el 19 % del daño»— se divide por la pelea, y se llama
  aportación, **no dps**.
- Los dos pueden convivir en la misma fila **si están rotulados**. Lo que no
  puede es haber uno sin decir cuál.

> **El fallo del competidor no es una cifra mal calculada: es una aportación
> llamada tasa.** Y el nuestro es el mismo, con el agravante de que la cifra
> buena ya la teníamos calculada al lado.
