/**
 * This script hunts for video tags and initializes the correct player
 * depending on the platform:
 * - web: jwplayer
 * - iOS/Android: Native player
 *
 * Once jwplayer is initialized there's no follow up actions to be taken.
 * Mobile Native players send back information into the DOM in order to
 * interact and update the UI, therefore a MutationObserver is registered.
 */

/* eslint no-use-before-define: 0 */
/* eslint no-param-reassign: 0 */
/* eslint no-useless-escape: 0 */
/* global jwplayer */

function initializeVideoPlayback() {
  var nativeBridgeMessage;
  var currentTime = '0';

  function getById(name) {
    return document.getElementById(name);
  }

  function isNativeIOS() {
    return (
      navigator.userAgent === 'DEV-Native-ios' &&
      window &&
      window.webkit &&
      window.webkit.messageHandlers &&
      window.webkit.messageHandlers.video
    );
  }

  function isNativeAndroid() {
    return (
      navigator.userAgent === 'DEV-Native-android' &&
      typeof AndroidBridge !== 'undefined' &&
      AndroidBridge !== null &&
      AndroidBridge.videoMessage !== undefined
    );
  }

  function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
      results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
  }

  function timeToSeconds(hms) {
    var a;
    if (hms.length < 3) {
      return hms;
    } else if (hms.length < 6) {
      a = hms.split(':');
      return (hms = +a[0] * 60 + +a[1]);
    } else {
      a = hms.split(':');
      return (hms = +a[0] * 60 * 60 + +a[1] * 60 + +a[2]);
    }
  }

  function initWebPlayer(seconds, metadata) {
    var waitingOnJWP = setInterval(function () {
      if (typeof jwplayer !== 'undefined') {
        clearInterval(waitingOnJWP);
        var playerInstance = jwplayer(`video-player-${metadata.id}`);
        playerInstance.setup({
          file: metadata.video_source_url,
          mediaid: metadata.video_code,
          autostart: true,
          image: metadata.video_thumbnail_url,
          playbackRateControls: true,
          tracks: [
            {
              file: metadata.video_closed_caption_track_url,
              label: 'English',
              kind: 'captions',
              default: false,
            },
          ],
        });
        if (seconds) {
          jwplayer().on('ready', function (event) {
            jwplayer().play();
          });
          jwplayer().on('firstFrame', function () {
            jwplayer().seek(seconds);
          });
        }
      }
    }, 2);
  }

  function videoMetadata(videoSource) {
    try {
      return JSON.parse(videoSource.dataset.meta);
    } catch (e) {
      console.log('Unable to load Podcast Episode metadata', e); // eslint-disable-line no-console
    }
  }

  function requestFocus() {
    var metadata = videoMetadata(videoSource);
    var playerElement = getById(`video-player-${metadata.id}`);

    getById('pause-butt').classList.add('active');
    getById('play-butt').classList.remove('active');

    nativeBridgeMessage({
      action: 'play',
      url: metadata.video_source_url,
      seconds: currentTime,
    });
  }

  function handleVideoMessages(mutation) {
    if (mutation.type !== 'attributes') {
      return;
    }

    var message = {};
    try {
      var messageData = getById('video-player-source').dataset.message;
      message = JSON.parse(messageData);
    } catch (e) {
      console.log(e); // eslint-disable-line no-console
      return;
    }

    if (message.action == 'pause') {
      getById('pause-butt').classList.remove('active');
      getById('play-butt').classList.add('active');
    } else if (message.action == 'tick') {
      currentTime = message.currentTime;
    }
  }

  function initializePlayer(videoSource) {
    var seconds = timeToSeconds(getParameterByName('t') || '0');
    var metadata = videoMetadata(videoSource);

    if (isNativeIOS()) {
      nativeBridgeMessage = function (message) {
        try {
          window.webkit.messageHandlers.video.postMessage(message);
        } catch (err) {
          console.log(err.message); // eslint-disable-line no-console
        }
      };
    } else if (isNativeAndroid()) {
      nativeBridgeMessage = function (message) {
        try {
          AndroidBridge.videoMessage(JSON.stringify(message));
        } catch (err) {
          console.log(err.message); // eslint-disable-line no-console
        }
      };
    } else {
      // jwplayer is initialized and no further interaction is needed
      initWebPlayer(seconds, metadata);
      return;
    }

    var playerElement = getById(`video-player-${metadata.id}`);
    playerElement.addEventListener('click', requestFocus);

    playerElement.classList.add('native');
    getById('pause-butt').classList.add('active');

    var mutationObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        handleVideoMessages(mutation);
      });
    });
    mutationObserver.observe(videoSource, { attributes: true });

    currentTime = `${seconds}`;
    nativeBridgeMessage({
      action: 'play',
      url: metadata.video_source_url,
      seconds: currentTime,
    });
  }

  // If an video player element is found initialize it
  var videoSource = getById('video-player-source');
  if (videoSource !== null) {
    initializePlayer(videoSource);
  }
}