# Pitirre

Pitirre es el cliente de control remoto de [Yunque](https://yunque-blond.vercel.app). Es una versión modificada de [RustDesk](https://github.com/rustdesk/rustdesk) 1.5.0 que viene configurada de fábrica para conectarse solo a nuestro servidor: no hay que escribir el servidor ni la llave en cada equipo.

## Créditos y licencia

Pitirre existe gracias al trabajo del equipo de RustDesk (Purslane Tech Pte. Ltd. y sus colaboradores). Igual que RustDesk, se distribuye bajo la licencia AGPL-3.0; el texto completo está en [LICENCE](LICENCE). El código fuente de cada versión publicada está en la rama `pitirre` de este repositorio, y el README original de RustDesk se conserva en [README-RustDesk.md](README-RustDesk.md).

## Descargas

Las versiones se publican en [Releases](https://github.com/xxxbii/pitirre/releases) con la etiqueta `pitirre-v<versión>`:

| Archivo | Para qué sirve |
| --- | --- |
| `Pitirre-<versión>-windows-x64.exe` | Windows 10 u 11 de 64 bits. Funciona sin instalar; desde la app se puede instalar como servicio. |
| `Pitirre-<versión>-android-universal.apk` | Cualquier teléfono o tableta Android. |
| `Pitirre-<versión>-android-arm64.apk`, `-armv7.apk`, `-x86_64.apk` | La misma app, más liviana, para un tipo de procesador específico. |
| `SHA256SUMS.txt` | Huellas SHA-256 para verificar las descargas. |

## Plataformas

- **Windows (x64) y Android:** app Pitirre con su nombre, sus íconos y nuestro servidor ya integrados.
- **iPhone, Mac y Linux:** se usa la app oficial de RustDesk, configurada con nuestro servidor y nuestra llave pública (Yunque genera el código y el QR para configurarla).

## Servidor y llave

El servidor y la llave pública se incrustan al compilar. Sus valores están en el flujo `.github/workflows/pitirre.yml` y se pueden reemplazar, sin tocar el código, con las variables del repositorio `PITIRRE_HOST` y `PITIRRE_KEY` (Settings, Secrets and variables, Actions, pestaña Variables):

| Variable | Valor actual | Qué es |
| --- | --- | --- |
| `PITIRRE_HOST` | `srv1579804.hstgr.cloud` | Dominio o IP del servidor de IDs (hbbs), sin `http://`. El puerto es opcional; por defecto se usa 21116. |
| `PITIRRE_KEY` | `tkUOZtLzSVmqo1HNGwTSbfenitSHytefffHOq186CVA=` | Contenido de `id_ed25519.pub` del servidor (44 caracteres). |

El código está en `libs/hbb_common/src/config.rs`: si una variable de compilación no existe o está vacía, se usan los valores de RustDesk. El flujo de publicación siempre las define, revisa su formato antes de compilar y, después de compilar, comprueba que el servidor y la llave quedaron dentro de la app. El relay es el que anuncie el servidor o, si no anuncia ninguno, el mismo servidor en el puerto 21117. El servidor de cuentas (API) se deduce como `http://<servidor>:21114`; el instalador básico no lo incluye, así que el inicio de sesión y la libreta de direcciones no funcionan hasta que haya uno.

## Cómo compilar

1. Para usar otro servidor, crea las variables del repositorio `PITIRRE_HOST` y `PITIRRE_KEY`; si no existen, se usan los valores de la tabla anterior. Para firmar los APK de Android con una llave propia, crea los secretos `ANDROID_SIGNING_KEY` (el keystore en base64), `ANDROID_ALIAS`, `ANDROID_KEY_STORE_PASSWORD` y `ANDROID_KEY_PASSWORD`. Sin ellos, todos los APK de un release se firman con una misma llave temporal que cambia en cada release, así que para actualizar hay que desinstalar la versión anterior. Para crear la llave permanente una sola vez (en tu computadora, con Java instalado):

   ```bash
   keytool -genkeypair -keystore pitirre.jks -storetype PKCS12 -alias pitirre -keyalg RSA -keysize 3072 -validity 10000 -dname "CN=Pitirre"
   ```

   ```bash
   base64 -w0 pitirre.jks > pitirre.jks.b64
   ```

   El contenido de `pitirre.jks.b64` va en `ANDROID_SIGNING_KEY`, `pitirre` en `ANDROID_ALIAS` y la contraseña que elegiste en `ANDROID_KEY_STORE_PASSWORD` y `ANDROID_KEY_PASSWORD`. Guarda `pitirre.jks` en un lugar seguro: si se pierde, no se podrán publicar actualizaciones que se instalen encima.
2. Haz que `pitirre` sea la rama predeterminada del repositorio (GitHub solo muestra los flujos manuales que existen en esa rama) y activa Actions si el fork las tiene desactivadas.
3. En Actions, abre **Pitirre: compilar y publicar**, pulsa **Run workflow** y escribe la versión (por ejemplo `1.0.0`).
4. Al terminar queda publicado el release `pitirre-v<versión>` con los archivos de la tabla de descargas.

Ese es el único flujo que corre en esta rama, y solo a mano: los flujos heredados de RustDesk ya no se activan con push, pull request ni horarios.

## Instalar el servidor

En un VPS con Ubuntu o Debian:

```bash
curl -fsSL https://yunque-blond.vercel.app/pitirre/instalar.sh | sudo bash
```

El instalador levanta el servidor de IDs y el relay de RustDesk en Docker y usa los puertos 21115 (TCP), 21116 (TCP y UDP) y 21117 (TCP).

## Notas de seguridad

- **La llave pública no es secreta.** Va dentro de la app, aparece en la página pública de Pitirre y cualquiera puede extraerla de un release. Sirve para que la app compruebe que habla con nuestro servidor y no con uno falso.
- **Cualquiera que tenga la app puede usar el servidor.** El servidor libre no tiene cuentas, así que la protección real está en cada equipo: usa contraseñas permanentes fuertes o la aprobación con clic, y no compartas el ID junto con la contraseña. Nadie legítimo pide acceso por sorpresa.
- **Las sesiones van cifradas de extremo a extremo.** El relay solo pasa datos que no puede leer.
- **Pitirre no se actualiza desde RustDesk.** La comprobación de versiones y la actualización automática de RustDesk están desactivadas en esta app; las versiones nuevas salen solo de los Releases de este repositorio.
- **Verifica lo que instalas.** El ejecutable de Windows no tiene firma de código, así que SmartScreen puede advertir al abrirlo; compara su SHA-256 con `SHA256SUMS.txt`. Descarga solo desde los Releases de este repositorio o desde Yunque.
- **Guarda las llaves privadas fuera del repositorio.** `id_ed25519` se queda en el servidor y el keystore de Android en un lugar seguro. Si cambias el keystore, Android pedirá desinstalar la versión anterior antes de instalar la nueva.
