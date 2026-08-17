# Datos consultados — lo que sabemos por fuera del registro

Aquí va lo que **no hemos medido nosotros**: viene de una fuente de fuera, con su
nombre y su fecha. Es el tercer tipo de dato del proyecto, y no se mezcla con los
otros dos:

- **medido** — sale de nuestro registro, con su población y su corrida.
- **declarado** — lo afirma Campeón, que es quien juega.
- **consultado** — lo dice alguien de fuera. Va aquí, **con la fecha en que se
  trajo**, porque un catálogo de fuera envejece y nosotros no nos enteramos.

**Ninguno de estos datos está cableado en el código.** No hay importación, no hay
tabla, no hay valor por defecto. Están escritos para poder contrastarlos.

**Y la regla que gobierna este fichero:** *la fiabilidad no es de la fuente, es
del campo.* Cada entrada de aquí lleva por eso una columna de **contraste**: qué
hemos podido comprobar contra el registro, y qué no.

---

## 1 · La isla de las abejas, Plano del Cielo

| | |
|---|---|
| **fuente** | `eqlwiki.com` |
| **quién la trajo** | Campeón |
| **fecha de extracción** | **16 de agosto de 2026** |
| **URL** | <https://eqlwiki.com/Plane_of_Sky> |
| **alcance** | **sólo esta isla.** No se ha traído el catálogo de Plano del Cielo |

### El árbol

De la abeja de partida sale un número **variable** de hijas con el mismo nombre,
y **la rama depende de cuántas salgan**:

```
  bzzazzt  (la de partida)
      │
      ├─ salen TRES  bazzzazzt  ──▶  finales. NO hay jefe en esta tirada.
      │
      ├─ salen DOS   bazzzazzt  ──▶  cada una da una  bizazzt
      │                                   └─ finales. Tampoco hay jefe.
      │
      └─ sale  UNA   bazzzazzt  ──▶  bzzzt  (mini-reina)
                                          └─▶  bazzt Zzzt  (JEFE de la isla)
```

**Lo que la wiki dice además, y es la parte que importa:** *no se puede saber en
qué rama estás.* Lo único que ofrece para distinguirlas es **visual** —la abeja
de partida que lleva a la reina es más grande—, y eso un registro de texto no lo
ve.

### Los nombres, como los escribe el registro

**La wiki y el registro no escriben igual las nietas.** La wiki dice `Bizazzt`;
nuestro registro tiene dos formas, `bizazzzt` (53 s de golpes, 1 muerte) y
`bizzzzt` (13 s, 1 muerte). **No sabemos si son dos bichos o dos maneras de
escribir uno**, y no hace falta saberlo para el árbol: las dos son hojas.

| en el árbol | en nuestro registro | muertes vistas |
|---|---|---:|
| abeja de partida | `bzzazzt` | 7 |
| hijas (1, 2 o 3) | `bazzzazzt` | 6 |
| nietas de la rama de 2 | `bizazzzt` · `bizzzzt` | 1 · 1 |
| mini-reina | `bzzzt` | 3 |
| jefe | ``bazzt Zzzt`` | 3 |

### BLOQUEO · Los nombres, no el árbol

**Lo que impide cruzar esta fuente con nuestra medición no es el árbol —que
encaja— sino que los nombres no casan.** Tres grafías para lo mismo, o para dos
cosas, y no se sabe cuál:

| grafía | de dónde | qué consta |
|---|---|---|
| `Bizazzt` | wiki, 16 ago 2026 | la hoja de la rama de dos, en singular |
| `bizazzzt` | nuestro registro | 53 s con golpe suyo, 1 muerte |
| `bizzzzt` | nuestro registro | 13 s con golpe suyo, 1 muerte |

**No se pueden cruzar dos fuentes por una clave que no casa.** Cualquier función
que junte lo consultado con lo medido —un aviso, un temporizador, una
comparación— necesita antes una correspondencia de nombres entre las dos, y aquí
no la hay. **Es condición previa, no un detalle de presentación.**

**Y es la primera vez que la identidad de nombres nos bloquea hacia FUERA.** Las
demás veces —las seis copias del plegado, `The Spiroc Guardian`, `orc centurion`
frente a `Orc centurion`— eran dos partes nuestras que no se entendían entre sí, y
se arreglaban plegando. **Aquí una de las dos partes es de otro**, no se puede
cambiar, y plegar por nuestra cuenta sería decidir que `bizazzzt` y `bizzzzt` son
lo mismo sin tener con qué.

**Sólo queda anotado. No se resuelve ahora.**

### El contraste: qué hemos podido comprobar

| campo del árbol | contrastado | resultado |
|---|---|---|
| las cadenas y su orden | **sí** | las cuatro salen del registro por sí solas, con huecos de 0–1 s |
| que sólo la rama de 1 lleve al jefe | **sí** | **7 de 7 episodios** medidos en el registro |
| «no se puede saber en qué rama estás» | **sí** | **se queda corta**: la cadencia de golpes lo dice |
| que las de la rama de 3 sean finales | **no** | el único episodio que leemos como 3 no acabó con ninguna muerta |
| la distinción visual (más grande) | **no se puede** | el registro no da tamaños |
| cuántas salen y con qué probabilidad | **no lo dice la wiki** | tampoco lo hemos medido: 7 episodios no son una proporción |

**El árbol es la primera cosa consultada de este proyecto que el registro
CONFIRMA en vez de discutir**, y conviene decirlo al lado de que el mismo sitio
nos dio un temporizador por debajo de nuestro suelo medido. Es el ejemplo de por
qué la fiabilidad se mira campo a campo.

---

## Lo que este fichero no es

- **No es una tabla que el programa lea.** Si algún día lo fuera, la fecha de
  extracción tiene que salir **en pantalla**, no aquí.
- **No es una autoridad.** Cuando lo consultado y lo medido se separan, se enseñan
  los dos y se dice cuál es cuál.
- **No crece por gusto.** Se anota lo que se va a contrastar. Traer un catálogo
  entero es traer trabajo sin medir.
