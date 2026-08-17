# La reaparición, reagrupada por instancia — y lo que salió por el camino

Sale de [D11](HECHOS-DECLARADOS.md): en EQL una zona instanciada **sí** tiene
reaparición, y **el tiempo se elige al crear la instancia**. Eso corrige una
deducción mía —«instancia = sin reaparición»— que era conocimiento de otros
juegos aplicado a éste.

Medido el **17 de agosto de 2026** sobre el registro entero: 93 MB, 4–17 de
agosto, **5.426 muertes con visita conocida en 648 visitas**.

---

## C2 · La instancia SÍ está en el registro; el tiempo elegido NO

```
[Tue Aug 04 11:59:19 2026] Player Campeon creating instance Nagafen's Lair 15001.
[Tue Aug 04 11:59:19 2026] Nagafen's Lair - Solo is now available to you.
[Tue Aug 04 11:59:27 2026] LOADING, PLEASE WAIT...
```

Tres líneas, y con ellas se sabe **qué zona, qué modo y qué instancia** —el
número es un identificador, no un ajuste: van 15001, 15010, 90, 83, 309, 492…—.
**El tiempo de reaparición elegido no aparece en ninguna parte**, ni en esas tres
líneas ni alrededor.

Así que D11 se queda **declarado**: el mecanismo lo cuenta Campeón, y del
registro sólo sale la **unidad** —la instancia— con la que agrupar. Que no es
poco: es exactamente lo que faltaba.

**Y una cosa que no esperaba: las instancias SE REENTRAN.** Las cuatro visitas a
`Befallen 2 (Adaptive)` del registro no llevan delante ninguna línea de creación,
así que o son la misma instancia reabierta días después, o son de otro. Con lo
cual **visita ≠ instancia**, y agrupar por visita es una cota: dos visitas pueden
ser la misma instancia y no hay cómo saberlo cuando falta la línea.

## C1 · Reagrupado por visita: hay racimos DENTRO, y no son los mismos entre visitas

Mínimos por nombre dentro de cada visita, con el filtro de siempre —por debajo de
60 s son dos individuos— y descartando lo que pase de una hora:

| visita | nombres | mínimos |
|---|---:|---|
| **Befallen 2, 7 ago** | 27 | 1:05 · 1:12 · 1:22 · 1:36 · 1:38 · 1:42 · 1:42 · 2:31 · 3:13 · **5:31 · 5:32 · 5:56 · 5:59** · 7:39 · 8:48 · **9:31 · 9:33 · 9:37** · 12:21 · 12:38 · 23:27 · … |
| **Befallen 2, 10 ago** | 14 | 1:00 · 1:03 · 1:05 · 1:12 · 1:29 · 1:38 · **1:47 · 1:47** · 2:05 · 2:29 · 3:21 · 7:28 · 10:14 · 19:24 |
| **Befallen 2, 12 ago** | 21 | 1:03 · 1:06 · 1:11 · 1:18 · **1:28 · 1:30 · 1:30** · 1:49 · 2:02 · 2:12 · 2:30 · 2:43 · 3:11 · 4:30 · 5:28 · 6:00 · 8:07 · 8:47 · … |
| **Befallen 2, 14 ago** | 12 | 1:01 · 1:12 · **1:21 · 1:26 · 1:27** · 1:41 · **1:44 · 1:51 · 1:54 · 1:56** · 2:46 · 8:24 |

**Dentro de una visita aparecen racimos apretados** —5:31/5:32/5:56/5:59 y
9:31/9:33/9:37 el día 7— **y no reaparecen en las otras visitas**. Eso es
compatible con «el ajuste es de la instancia»… y también con «ese día campó una
sala y otro día campó otra». **Con cuatro visitas no se separa una cosa de la
otra**, y decir que se separa sería el mismo error que ya se corrigió en §3.7:
escoger la mitad que apoya la idea.

**Lo que sí queda medido y es nuevo:** el 71 % de los mínimos que sostienen la
medición de §3.3 salen de **dentro de una sola visita** (345 de 486 pares), así
que no son huecos de «me fui y volví». Eso era una duda razonable y ya no lo es.

---

## Y EL BLOQUEO, que es lo más importante de esta página

**No he podido reproducir el racimo de 4:27 de Befallen.** Los cuatro nombres que
lo forman, muerte a muerte en el registro de hoy:

| nombre | muertes | mínimo dentro de una visita |
|---|---:|---|
| ``Kahaptra Z`Taj`` | 2 | **ninguno** — sus dos muertes están a 55 h, en visitas distintas |
| `an elf skeleton` | 5 | **5:28** |
| `Gynok Moltor` | 6 | **6:00** |
| `the thaumaturgist` | 29 | **1:17** en Befallen |

Ninguno da 4:27, y el mínimo de ``Kahaptra Z`Taj`` **no existe** con este método.

**Dos lecturas posibles, y no se puede elegir sin la nota:**

1. La medición publicada no contaba muerte→muerte sino **muerte→siguiente
   combate**, que es menor y encaja: 4:27 de reaparición más el rato de volver a
   matarlo dan los 5:28 y 6:00 que salen aquí.
2. La medición se hizo sobre otra población.

**Es el mismo problema que las abejas**, dos veces el mismo día: la cifra está
publicada y el método con el que se sacó no está escrito, así que no se puede
repetir. Y aquí importa más, porque §3.6 usa el 4:27 de ``Kahaptra Z`Taj`` para
decir que **coincidimos con la wiki al segundo**, y ese 4:27 no se puede
re-derivar con lo que hay escrito.

> **Antes de renombrar el racimo —de «el tiempo de Befallen» a «el tiempo de las
> instancias que Campeón crea en Befallen»— hay que poder volver a medirlo.**
> Renombrar una cifra que no se sabe reproducir es cambiarle la etiqueta a algo
> que no se ha vuelto a ver.

## Lo que sí se puede decir ya, y va a §3.7 y §4.8

- **«El tiempo de Befallen» no se puede sostener como nombre.** Si el ajuste se
  elige al crear la instancia, dos instancias de la misma zona pueden tener
  tiempos distintos, y el racimo —exista donde exista— describe **una** de ellas.
- **Y no se puede generalizar a otro jugador**: otro elegiría otro ajuste. Lo que
  midamos aquí vale para las instancias de Campeón y para nadie más.
- **Sky sale de la medición igual que antes, pero por el motivo bueno**: no
  porque «las instancias no reaparezcan» —que era falso— sino porque lo que allí
  aparece es **una cadena de apariciones**, cada bicho trayendo al siguiente, y
  eso no es reaparición: es otra mecánica, la de [D9](HECHOS-DECLARADOS.md).
