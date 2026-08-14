# Skills de este repo

La skill `frc-mobile-pwa` vive versionada acá y se usa desde
`~/.claude/skills/frc-mobile-pwa/`. Para tomarla en una máquina nueva:

```bash
ln -s "$PWD/.claude/skills/frc-mobile-pwa" ~/.claude/skills/frc-mobile-pwa
```

Versionarla tiene un motivo: la skill dice **qué leer y qué cuesta caro no
saber**, y eso cambia con el código. Fuera del repo se desincroniza en
silencio y nadie se entera hasta que da un consejo viejo.

**Qué va en la skill y qué en `docs/`:** la skill es el índice y las seis
trampas que hay que conocer *antes* de abrir un archivo. Todo lo demás
—patrones, módulos, arquitectura— va en `docs/`, que es la fuente.
