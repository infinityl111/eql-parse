/**
 * Los textos de la web, y por qué son tan pocos.
 *
 * LA DECISIÓN DE FONDO: no son cinco idiomas lo que cuesta, es cuánto texto
 * lleva cada uno. Con cinco copias de tres artículos, cada versión nueva son
 * cinco traducciones y a la tercera se dejan de hacer. Así que la superficie
 * traducible se reduce hasta que traducirla cinco veces no cuesta:
 *
 *   · LOS NOMBRES DE LAS FUNCIONES NO ESTÁN AQUÍ. Salen de `src/i18n.js`, el
 *     mismo diccionario que usa la aplicación, que ya tiene más de 600 claves
 *     en los cinco idiomas. «Aguantar», «Qué lanzó cada uno», «El registro»:
 *     ya están traducidos, y traducirlos otra vez aquí sería crear una segunda
 *     versión que se desincroniza.
 *
 *   · LA PROSA LARGA —el porqué de cada medida— sólo va en español e inglés,
 *     que es lo que existe escrito. Las otras tres enlazan al inglés Y LO
 *     DICEN, en vez de dejar una página a medias sin explicación.
 *
 * Con eso, una versión nueva toca estas cadenas cortas y nada más.
 */

export const IDIOMAS = ['es', 'en', 'fr', 'de', 'pt'];

/** Los que tienen prosa larga propia. Los demás la enlazan en inglés. */
export const CON_PROSA = ['es', 'en'];

export const NOMBRE_IDIOMA = {
  es: 'Español', en: 'English', fr: 'Français', de: 'Deutsch', pt: 'Português',
};

export const T = {
  es: {
    tagline: 'Mide tus combates de EverQuest Legends',
    sub: 'No solo cuenta lo que hiciste: te dice qué cambiar. Y cada cifra dice de dónde sale.',
    descargar: 'Descargar para Windows',
    gratis: 'Gratis y de código abierto',
    verGithub: 'Ver el código',
    nav: { inicio: 'Inicio', instalar: 'Instalación', novedades: 'Novedades', mide: 'Qué mide' },
    queEs: 'Qué es',
    queEsP: 'Una aplicación de escritorio que lee el fichero de registro de EverQuest Legends mientras juegas y te dice qué pasó en cada combate: cuánto puso cada uno, quién aguantó, qué se lanzó y cuánto tiempo estuvo puesto. No toca el juego ni le habla: sólo lee un fichero de texto que el propio juego escribe.',
    funciones: 'Lo que trae',
    reproductor: 'La reproducción',
    reproductorP: 'Vuelve a ver la pelea segundo a segundo, con los números flotando sobre cada combatiente como en el juego. Sale del registro releído, no de las cifras ya sumadas: cada número que ves es una línea de tu fichero.',
    capturas: 'Cómo se ve',
    instalarT: 'Instalación',
    instalarP: 'Descarga el instalador, ejecútalo y elige dónde quieres el programa. La primera vez te pedirá dónde está tu fichero de registro; suele encontrarlo solo.',
    paso1: 'Descarga el instalador desde la última versión.',
    paso2: 'Ejecútalo. Windows puede avisarte de que el editor es desconocido: la aplicación no está firmada, y firmarla cuesta dinero que este proyecto no tiene. Pulsa «Más información» y luego «Ejecutar de todas formas».',
    paso3: 'Ábrela y dile dónde está tu registro de EverQuest Legends. Si el juego no lo está escribiendo, activa el registro con /log on dentro del juego.',
    paso4: 'A partir de ahí las siguientes versiones se descargan e instalan desde la propia aplicación, sin volver a pasar por esto.',
    requisitos: 'Requisitos',
    requisitosP: 'Windows 10 o posterior. Nada más: no necesita cuenta, ni conexión para funcionar, ni permisos de administrador.',
    privacidad: 'Qué NO hace',
    privacidadP: 'No modifica el juego ni se comunica con él. No manda tus datos a ninguna parte: todo lo que mide se queda en tu ordenador. Sólo sale a la red para consultar la wiki de EQL —iconos y fichas de enemigos— y para mirar si hay versión nueva.',
    novedadesT: 'Novedades',
    novedadesP: 'Cada versión con lo que cambió y por qué.',
    verTodas: 'Todas las versiones en GitHub',
    mideT: 'Qué mide, y qué no',
    mideP: 'Un medidor de combate es una cuenta sobre líneas de texto. Lo que decide si vale es qué se cuenta, qué se deduce y qué no se puede saber — y que cada cifra diga cuál de las tres es.',
    soloIngles: 'Esta página sólo está escrita en español e inglés. Te llevamos a la inglesa.',
    verEnIngles: 'Leerla en inglés',
    desc: {
      reparto: 'Cuánto puso cada uno y a qué ritmo real: el daño contra los segundos en los que de verdad hizo algo, no contra la pelea entera.',
      aguantar: 'Lo que te lanzaron y lo que no llegó a entrar. Casi la mitad de los ataques se evitan, y eso también se cuenta.',
      lanzar: 'Cada hechizo, quién lo lanzó, cuándo, y cuánto tiempo estuvo puesto encima.',
      postura: 'Qué postura te habría evitado más daño, deducida de tus clases y de lo que te pegó.',
      registro: 'Las líneas originales de la pelea, con lo que pasó justo antes y justo después, sin salir de la aplicación.',
      enciclopedia: 'La ficha de cada enemigo: qué pega, cuánto, dónde vive y qué suelta.',
      reproduccion: 'Vuelve a ver la pelea segundo a segundo, con los números flotando sobre cada combatiente.',
      overlay: 'Un panel encima del juego con lo que va pasando, sin salir de la pantalla ni pasar por la aplicación.',
    },
    pies: {
      'combate.png': 'El combate, jugador a jugador',
      'analisis.png': 'El análisis, separando lo que puedes cambiar',
      'enciclopedia.png': 'La enciclopedia de enemigos, zonas y botín',
      'overlay.png': 'El overlay, encima del juego',
      'postura.png': 'El consejo de postura, medido sobre lo que te pegó en esa pelea: cuánto habría evitado cada una, y lo que cuesta.',
    },
    pie: 'Hecho por Campeon Delmundo, de la hermandad SPAIN.',
    idioma: 'Idioma',
  },
  en: {
    tagline: 'Measure your EverQuest Legends fights',
    sub: 'It does not just count what you did: it tells you what to change. And every figure says where it comes from.',
    descargar: 'Download for Windows',
    gratis: 'Free and open source',
    verGithub: 'View the code',
    nav: { inicio: 'Home', instalar: 'Install', novedades: 'Releases', mide: 'What it measures' },
    queEs: 'What it is',
    queEsP: 'A desktop app that reads the EverQuest Legends log file while you play and tells you what happened in each fight: who put in what, who took the hits, what was cast and how long it stayed up. It does not touch the game or talk to it: it only reads a text file the game itself writes.',
    funciones: 'What it does',
    reproductor: 'The replay',
    reproductorP: 'Watch the fight again second by second, with the numbers floating over each combatant like in the game. It comes from the log, re-read — not from figures already added up: every number you see is a line of your file.',
    capturas: 'How it looks',
    instalarT: 'Install',
    instalarP: 'Download the installer, run it and pick where you want the program. The first time it will ask where your log file is; it usually finds it on its own.',
    paso1: 'Download the installer from the latest release.',
    paso2: 'Run it. Windows may warn you the publisher is unknown: the app is not signed, and signing costs money this project does not have. Click "More info" and then "Run anyway".',
    paso3: 'Open it and point it at your EverQuest Legends log. If the game is not writing one, turn logging on with /log on inside the game.',
    paso4: 'From then on, later versions download and install from inside the app, without going through this again.',
    requisitos: 'Requirements',
    requisitosP: 'Windows 10 or later. Nothing else: no account, no connection to work, no administrator rights.',
    privacidad: 'What it does NOT do',
    privacidadP: 'It does not modify the game or communicate with it. It sends your data nowhere: everything it measures stays on your computer. It only reaches the network to look things up on the EQL wiki — icons and enemy pages — and to check whether a new version exists.',
    novedadesT: 'Releases',
    novedadesP: 'Every version with what changed and why.',
    verTodas: 'All releases on GitHub',
    mideT: 'What it measures, and what it does not',
    mideP: 'A combat meter is a count over lines of text. What decides whether it is any good is what gets counted, what gets inferred and what cannot be known — and that every figure says which of the three it is.',
    soloIngles: 'This page is only written in Spanish and English.',
    verEnIngles: 'Read it in English',
    desc: {
      reparto: 'Who put in what, and at what real pace: damage against the seconds they were actually doing something, not against the whole fight.',
      aguantar: 'What was thrown at you and what never landed. Almost half of all attacks are avoided, and that gets counted too.',
      lanzar: 'Every spell, who cast it, when, and how long it stayed up.',
      postura: 'Which stance would have saved you the most damage, inferred from your classes and from what hit you.',
      registro: 'The original lines of the fight, with what happened just before and just after, without leaving the app.',
      enciclopedia: 'A file on every enemy: what it hits with, how hard, where it lives and what it drops.',
      reproduccion: 'Watch the fight again second by second, with the numbers floating over each combatant.',
      overlay: 'A panel on top of the game with what is going on, without leaving the screen or going through the app.',
    },
    pies: {
      'combate.png': 'The fight, player by player',
      'analisis.png': 'The analysis, separating what you can change',
      'enciclopedia.png': 'The encyclopedia of enemies, zones and loot',
      'overlay.png': 'The overlay, on top of the game',
      'postura.png': 'The stance advice, measured against what actually hit you in that fight: how much each one would have prevented, and what it costs.',
    },
    pie: 'Made by Campeon Delmundo, of the SPAIN guild.',
    idioma: 'Language',
  },
  fr: {
    tagline: 'Mesure tes combats sur EverQuest Legends',
    sub: 'Il ne compte pas seulement ce que tu as fait : il te dit quoi changer. Et chaque chiffre dit d’où il sort.',
    descargar: 'Télécharger pour Windows',
    gratis: 'Gratuit et open source',
    verGithub: 'Voir le code',
    nav: { inicio: 'Accueil', instalar: 'Installation', novedades: 'Nouveautés', mide: 'Ce qu’il mesure' },
    queEs: 'Qu’est-ce que c’est',
    queEsP: 'Une application de bureau qui lit le fichier journal d’EverQuest Legends pendant que tu joues et te dit ce qui s’est passé dans chaque combat. Elle ne touche pas au jeu et ne lui parle pas : elle lit seulement un fichier texte que le jeu écrit lui-même.',
    funciones: 'Ce qu’elle fait',
    reproductor: 'La relecture',
    reproductorP: 'Revois le combat seconde par seconde, avec les nombres qui flottent au-dessus de chaque combattant comme dans le jeu. Tout sort du journal relu : chaque nombre est une ligne de ton fichier.',
    capturas: 'À quoi ça ressemble',
    instalarT: 'Installation',
    instalarP: 'Télécharge l’installateur, lance-le et choisis où mettre le programme. La première fois il demandera où est ton fichier journal.',
    paso1: 'Télécharge l’installateur depuis la dernière version.',
    paso2: 'Lance-le. Windows peut t’avertir que l’éditeur est inconnu : l’application n’est pas signée. Clique sur « Informations complémentaires » puis « Exécuter quand même ».',
    paso3: 'Ouvre-la et indique-lui ton journal d’EverQuest Legends. Si le jeu n’en écrit pas, active-le avec /log on dans le jeu.',
    paso4: 'Ensuite, les versions suivantes se téléchargent et s’installent depuis l’application elle-même.',
    requisitos: 'Prérequis',
    requisitosP: 'Windows 10 ou plus récent. Rien d’autre : ni compte, ni connexion pour fonctionner, ni droits administrateur.',
    privacidad: 'Ce qu’elle ne fait PAS',
    privacidadP: 'Elle ne modifie pas le jeu et ne communique pas avec lui. Elle n’envoie tes données nulle part : tout reste sur ton ordinateur. Elle ne sort sur le réseau que pour consulter le wiki d’EQL et vérifier s’il existe une nouvelle version.',
    novedadesT: 'Nouveautés',
    novedadesP: 'Chaque version avec ce qui a changé et pourquoi.',
    verTodas: 'Toutes les versions sur GitHub',
    mideT: 'Ce qu’il mesure, et ce qu’il ne mesure pas',
    mideP: 'Un compteur de combat est un décompte sur des lignes de texte.',
    soloIngles: 'Cette page n’est écrite qu’en espagnol et en anglais.',
    verEnIngles: 'La lire en anglais',
    desc: {
      reparto: 'Ce que chacun a apporté, et à quel rythme réel : les dégâts rapportés aux secondes où il a vraiment agi, pas au combat entier.',
      aguantar: 'Ce qu’on t’a envoyé et ce qui n’est jamais passé. Près de la moitié des attaques sont évitées, et cela compte aussi.',
      lanzar: 'Ce que chacun a lancé, quand, et combien de temps c’est resté actif.',
      postura: 'La posture qui t’aurait évité le plus de dégâts, déduite de tes classes et de ce qui t’a frappé.',
      registro: 'Les lignes d’origine du combat, avec ce qui précède et ce qui suit, sans quitter l’application.',
      enciclopedia: 'La fiche de chaque ennemi : ce qu’il frappe, combien, où il vit et ce qu’il lâche.',
      reproduccion: 'Revois le combat seconde par seconde, avec les nombres qui flottent au-dessus de chaque combattant.',
      overlay: 'Un panneau par-dessus le jeu avec ce qui se passe, sans quitter l’écran ni passer par l’application.',
    },
    pies: {
      'combate.png': 'Le combat, joueur par joueur',
      'analisis.png': 'L’analyse, en séparant ce que tu peux changer',
      'enciclopedia.png': 'L’encyclopédie des ennemis, des zones et du butin',
      'overlay.png': 'La surcouche, par-dessus le jeu',
      'postura.png': 'Le conseil de posture, mesuré sur ce qui t’a frappé dans ce combat : ce que chacune aurait évité, et ce qu’elle coûte.',
    },
    pie: 'Fait par Campeon Delmundo, de la guilde SPAIN.',
    idioma: 'Langue',
  },
  de: {
    tagline: 'Miss deine Kämpfe in EverQuest Legends',
    sub: 'Es zählt nicht nur, was du getan hast: es sagt dir, was du ändern sollst. Und jede Zahl sagt, woher sie kommt.',
    descargar: 'Für Windows herunterladen',
    gratis: 'Kostenlos und quelloffen',
    verGithub: 'Code ansehen',
    nav: { inicio: 'Start', instalar: 'Installation', novedades: 'Neuerungen', mide: 'Was es misst' },
    queEs: 'Was es ist',
    queEsP: 'Eine Desktop-Anwendung, die die Logdatei von EverQuest Legends liest, während du spielst, und dir sagt, was in jedem Kampf passiert ist. Sie fasst das Spiel nicht an und spricht nicht mit ihm: sie liest nur eine Textdatei, die das Spiel selbst schreibt.',
    funciones: 'Was sie kann',
    reproductor: 'Die Wiedergabe',
    reproductorP: 'Sieh den Kampf Sekunde für Sekunde noch einmal, mit Zahlen, die über jedem Kämpfer schweben wie im Spiel. Alles kommt aus dem neu gelesenen Log: jede Zahl ist eine Zeile deiner Datei.',
    capturas: 'Wie es aussieht',
    instalarT: 'Installation',
    instalarP: 'Lade den Installer herunter, führe ihn aus und wähle, wohin das Programm soll. Beim ersten Start fragt es nach deiner Logdatei.',
    paso1: 'Lade den Installer aus der neuesten Version.',
    paso2: 'Führe ihn aus. Windows warnt womöglich, der Herausgeber sei unbekannt: die Anwendung ist nicht signiert. Klicke auf „Weitere Informationen“ und dann „Trotzdem ausführen“.',
    paso3: 'Öffne sie und zeige ihr dein EverQuest-Legends-Log. Schreibt das Spiel keines, schalte es mit /log on im Spiel ein.',
    paso4: 'Danach laden und installieren sich spätere Versionen aus der Anwendung heraus.',
    requisitos: 'Voraussetzungen',
    requisitosP: 'Windows 10 oder neuer. Sonst nichts: kein Konto, keine Verbindung zum Arbeiten, keine Administratorrechte.',
    privacidad: 'Was sie NICHT tut',
    privacidadP: 'Sie verändert das Spiel nicht und kommuniziert nicht mit ihm. Sie sendet deine Daten nirgendwohin: alles bleibt auf deinem Rechner. Ins Netz geht sie nur für das EQL-Wiki und um nach einer neuen Version zu sehen.',
    novedadesT: 'Neuerungen',
    novedadesP: 'Jede Version mit dem, was sich geändert hat, und warum.',
    verTodas: 'Alle Versionen auf GitHub',
    mideT: 'Was es misst und was nicht',
    mideP: 'Ein Kampfmesser ist eine Zählung über Textzeilen.',
    soloIngles: 'Diese Seite ist nur auf Spanisch und Englisch geschrieben.',
    verEnIngles: 'Auf Englisch lesen',
    desc: {
      reparto: 'Wer wie viel beigetragen hat, und in welchem echten Tempo: Schaden gegen die Sekunden, in denen wirklich etwas getan wurde, nicht gegen den ganzen Kampf.',
      aguantar: 'Was auf dich geworfen wurde und was nie ankam. Fast die Hälfte aller Angriffe wird vermieden, und auch das wird gezählt.',
      lanzar: 'Was jeder gewirkt hat, wann, und wie lange es oben blieb.',
      postura: 'Welche Haltung dir den meisten Schaden erspart hätte, abgeleitet aus deinen Klassen und aus dem, was dich getroffen hat.',
      registro: 'Die Originalzeilen des Kampfes, mit dem, was direkt davor und danach geschah, ohne die Anwendung zu verlassen.',
      enciclopedia: 'Ein Datenblatt zu jedem Gegner: womit er schlägt, wie hart, wo er lebt und was er fallen lässt.',
      reproduccion: 'Sieh den Kampf Sekunde für Sekunde noch einmal, mit Zahlen über jedem Kämpfer.',
      overlay: 'Ein Panel über dem Spiel mit dem, was gerade passiert — ohne den Bildschirm zu verlassen.',
    },
    pies: {
      'combate.png': 'Der Kampf, Spieler für Spieler',
      'analisis.png': 'Die Auswertung, getrennt nach dem, was du ändern kannst',
      'enciclopedia.png': 'Die Enzyklopädie der Gegner, Zonen und Beute',
      'overlay.png': 'Das Overlay, über dem Spiel',
      'postura.png': 'Der Haltungsvorschlag, gemessen an dem, was dich in diesem Kampf getroffen hat: was jede verhindert hätte und was sie kostet.',
    },
    pie: 'Gemacht von Campeon Delmundo, aus der Gilde SPAIN.',
    idioma: 'Sprache',
  },
  pt: {
    tagline: 'Mede os teus combates de EverQuest Legends',
    sub: 'Não conta só o que fizeste: diz-te o que mudar. E cada número diz de onde sai.',
    descargar: 'Descarregar para Windows',
    gratis: 'Grátis e de código aberto',
    verGithub: 'Ver o código',
    nav: { inicio: 'Início', instalar: 'Instalação', novedades: 'Novidades', mide: 'O que mede' },
    queEs: 'O que é',
    queEsP: 'Uma aplicação de secretária que lê o ficheiro de registo de EverQuest Legends enquanto jogas e te diz o que aconteceu em cada combate. Não toca no jogo nem fala com ele: só lê um ficheiro de texto que o próprio jogo escreve.',
    funciones: 'O que traz',
    reproductor: 'A reprodução',
    reproductorP: 'Vê a luta outra vez segundo a segundo, com os números a flutuar sobre cada combatente como no jogo. Sai do registo relido: cada número é uma linha do teu ficheiro.',
    capturas: 'Como se vê',
    instalarT: 'Instalação',
    instalarP: 'Descarrega o instalador, executa-o e escolhe onde queres o programa. À primeira vez pedirá onde está o teu ficheiro de registo.',
    paso1: 'Descarrega o instalador da última versão.',
    paso2: 'Executa-o. O Windows pode avisar que o editor é desconhecido: a aplicação não está assinada. Carrega em «Mais informações» e depois «Executar mesmo assim».',
    paso3: 'Abre-a e indica-lhe o teu registo de EverQuest Legends. Se o jogo não estiver a escrever um, liga-o com /log on dentro do jogo.',
    paso4: 'A partir daí, as versões seguintes descarregam-se e instalam-se a partir da própria aplicação.',
    requisitos: 'Requisitos',
    requisitosP: 'Windows 10 ou posterior. Mais nada: sem conta, sem ligação para funcionar, sem permissões de administrador.',
    privacidad: 'O que NÃO faz',
    privacidadP: 'Não modifica o jogo nem comunica com ele. Não envia os teus dados para lado nenhum: fica tudo no teu computador. Só vai à rede para consultar a wiki de EQL e para ver se há versão nova.',
    novedadesT: 'Novidades',
    novedadesP: 'Cada versão com o que mudou e porquê.',
    verTodas: 'Todas as versões no GitHub',
    mideT: 'O que mede, e o que não',
    mideP: 'Um medidor de combate é uma conta sobre linhas de texto.',
    soloIngles: 'Esta página só está escrita em espanhol e inglês.',
    verEnIngles: 'Ler em inglês',
    desc: {
      reparto: 'Quanto pôs cada um e a que ritmo real: o dano contra os segundos em que de facto fez alguma coisa, não contra o combate inteiro.',
      aguantar: 'O que te lançaram e o que nunca chegou a entrar. Quase metade dos ataques são evitados, e isso também se conta.',
      lanzar: 'O que cada um lançou, quando, e quanto tempo ficou activo.',
      postura: 'Que postura te teria evitado mais dano, deduzida das tuas classes e do que te bateu.',
      registro: 'As linhas originais do combate, com o que aconteceu mesmo antes e mesmo depois, sem sair da aplicação.',
      enciclopedia: 'A ficha de cada inimigo: com que bate, quanto, onde vive e o que larga.',
      reproduccion: 'Vê a luta outra vez segundo a segundo, com os números a flutuar sobre cada combatente.',
      overlay: 'Um painel por cima do jogo com o que vai acontecendo, sem sair do ecrã nem passar pela aplicação.',
    },
    pies: {
      'combate.png': 'O combate, jogador a jogador',
      'analisis.png': 'A análise, separando o que podes mudar',
      'enciclopedia.png': 'A enciclopédia de inimigos, zonas e espólio',
      'overlay.png': 'O overlay, por cima do jogo',
      'postura.png': 'O conselho de postura, medido sobre o que te bateu nesse combate: quanto cada uma teria evitado, e o que custa.',
    },
    pie: 'Feito por Campeon Delmundo, da irmandade SPAIN.',
    idioma: 'Idioma',
  },
};

/**
 * Las funciones que se anuncian, POR SU CLAVE en el diccionario de la
 * aplicación. Aquí no hay ni una palabra traducible: el nombre sale de
 * `src/i18n.js` y por tanto ya existe en los cinco idiomas.
 *
 * Si algún día se traduce un nombre en la aplicación, la web cambia sola.
 *
 * La descripción NO sale del diccionario: está en `desc`, aquí arriba, con
 * `icono` de clave. Se intentó con claves de la aplicación y no funciona —son
 * rótulos de interfaz, y «El registro · Mediana» no explica nada a quien llega
 * de fuera. Un nombre traducido se reutiliza; una frase hay que escribirla.
 */
export const FUNCIONES = [
  { icono: 'reparto', clave: 'side.allies' },
  { icono: 'aguantar', clave: 'tank.title' },
  { icono: 'lanzar', clave: 'casts.title' },
  { icono: 'postura', clave: 'adv.title' },
  { icono: 'registro', clave: 'log.title' },
  { icono: 'enciclopedia', clave: 'tab.encyclopedia' },
  // La reproducción estuvo de primera en la portada y no estaba entre las
  // funciones, que era incoherente: o es la tesis o es una más. Es una más.
  { icono: 'reproduccion', clave: 'rp.title' },
  // Y el overlay salía sólo como foto, sin una línea que dijera qué es.
  { icono: 'overlay', clave: 'hdr.overlay' },
];
