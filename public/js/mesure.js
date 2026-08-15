/*
 * Mesure d'audience maison.
 * -------------------------
 * Trois evenements :
 *   pv   page vue, au chargement
 *   out  clic vers un autre domaine
 *   fin  depart de la page, avec le temps passe et la profondeur de lecture
 *
 * Aucun cookie n'est depose par ce script. Il n'ecrit rien dans le navigateur
 * et n'empeche jamais la navigation : les envois passent par sendBeacon, qui
 * laisse le navigateur partir immediatement.
 *
 * Le corps est envoye en text/plain a dessein : cela evite la requete de
 * verification prealable CORS, et donc un aller-retour reseau inutile.
 */
(function () {
  'use strict';

  /* Le collecteur est un sous-domaine du site lui-meme. C'est ce qui permet a
     la mesure de survivre aux bloqueurs de publicite : une requete vers un
     domaine tiers est filtree par la plupart d'entre eux, une requete vers son
     propre domaine ne l'est pas. Le script est ainsi identique sur tous les
     sites, chacun envoyant chez lui. */
  var COLLECTEUR = 'https://stats.' + location.hostname.replace(/^www\./, '') + '/c';

  if (!navigator.sendBeacon) return;

  var ua = navigator.userAgent;

  /* Les robots n'ont pas a etre comptes. */
  if (/bot|crawl|spider|slurp|bingpreview|headless|lighthouse|pagespeed|preview/i.test(ua)) return;

  function envoyer(donnees) {
    try {
      navigator.sendBeacon(COLLECTEUR, new Blob([JSON.stringify(donnees)], { type: 'text/plain' }));
    } catch (e) { /* la mesure ne doit jamais casser la page */ }
  }

  /* ------------------------------------------------ contexte du visiteur */

  function navigateur() {
    if (/Edg\//.test(ua)) return 'Edge';
    if (/OPR\/|Opera/.test(ua)) return 'Opera';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/SamsungBrowser/.test(ua)) return 'Samsung Internet';
    if (/Chrome\//.test(ua)) return 'Chrome';
    if (/Safari\//.test(ua)) return 'Safari';
    return 'Autre';
  }

  function systeme() {
    if (/Windows/.test(ua)) return 'Windows';
    if (/Android/.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
    if (/Mac OS X/.test(ua)) return 'macOS';
    if (/Linux/.test(ua)) return 'Linux';
    return 'Autre';
  }

  /* Parametres de campagne presents dans l'adresse d'arrivee.
     Les identifiants de clic publicitaire sont releves pour reconnaitre la
     regie, mais le serveur n'en conserve que le nom : un gclid est unique par
     internaute, le stocker reviendrait a poser un identifiant persistant. */
  var IDS_PUB = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'ttclid'];

  function campagne() {
    var p = new URLSearchParams(location.search), out = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].concat(IDS_PUB).forEach(function (k) {
      if (p.has(k)) out[k] = p.get(k);
    });
    return out;
  }

  /* ------------------------------------------------------------ page vue */

  envoyer({
    t: 'pv',
    p: location.pathname,
    r: document.referrer || null,
    q: campagne(),
    nav: navigateur(),
    os: systeme(),
    larg: window.innerWidth || null,
    lang: (navigator.language || '').slice(0, 5) || null,
    err: /404|page introuvable/i.test(document.title) ? 1 : 0,
  });

  /* ------------------------------ temps passe et profondeur de lecture */

  var debut = Date.now();
  var lu = 0;

  function mesurerLecture() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var pc = h > 0 ? Math.round(((window.scrollY || 0) / h) * 100) : 100;
    if (pc > lu) lu = Math.min(100, pc);
  }
  addEventListener('scroll', mesurerLecture, { passive: true });
  mesurerLecture();

  var departEnvoye = false;
  function surDepart() {
    if (departEnvoye) return;
    departEnvoye = true;
    envoyer({
      t: 'fin',
      p: location.pathname,
      duree: Math.min(3600, Math.round((Date.now() - debut) / 1000)),
      scroll: lu,
    });
  }

  /* pagehide couvre le retour arriere et les onglets mis en cache par Safari,
     visibilitychange rattrape les fermetures d'onglet sur mobile, ou pagehide
     ne se declenche pas toujours. */
  addEventListener('pagehide', surDepart);
  addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') surDepart();
  });

  /* -------------------------------------------------- clics vers l'exterieur */

  function estExterne(a) {
    return a && a.href && a.hostname && a.hostname !== location.hostname
      && /^https?:$/.test(a.protocol);
  }

  function surClic(e) {
    var cible = e.target;
    if (!cible || typeof cible.closest !== 'function') return;
    var a = cible.closest('a[href]');
    if (!estExterne(a)) return;
    envoyer({ t: 'out', p: location.pathname, u: a.href, q: campagne() });
  }

  /* click ne couvre que le bouton principal, auxclick le clic molette et le
     clic droit. Les deux ne se declenchent jamais pour le meme geste : il n'y
     a donc pas de double comptage. */
  addEventListener('click', surClic, true);
  addEventListener('auxclick', surClic, true);
})();
