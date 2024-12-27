// ==UserScript==
// @name           Bluesky Enhancer
// @author         MaximDev
// @namespace      MAX1MDEV
// @version        1.0
// @homepage       https://github.com/MAX1MDEV/BlueskyEnhancer
// @supportURL     https://github.com/MAX1MDEV/BlueskyEnhancer/issues
// @updateURL      https://raw.githubusercontent.com/MAX1MDEV/BlueskyEnhancer/main/BlueskyEnhancer.user.js
// @downloadURL    https://raw.githubusercontent.com/MAX1MDEV/BlueskyEnhancer/main/BlueskyEnhancer.user.js
// @description    Add features including auto post liking, link copying, message quoting, hide functions, and more
// @description:ru Добавляет функции, включая автоматический лайк постов, копирование ссылок, цитирование сообщений, функции скрытия и другое
// @match          *://bsky.app/*
// @icon           https://i.imgur.com/Xe4hpJy.png
// @grant          none
// ==/UserScript==

(function () {
  'use strict';

  let throttleTimer;
  const throttleDelay = 250;
  let hideRepostsEnabled = false;
  let hideLikedPostsEnabled = false;
  let isWorking = false;

  function throttle(callback) {
    if (throttleTimer) return;
    throttleTimer = setTimeout(() => {
      callback();
      throttleTimer = null;
    }, throttleDelay);
  }

  function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'css-175oi2r r-1awozwy r-17c3jg3 r-1dzdj1l r-18rd0c5 r-18u37iz r-ctyi22 r-xaggoz r-1pcd2l5 r-1xcajam r-umfvqw';
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      background-color: rgba(0, 0, 0, 0.8);
      color: #fff;
      padding: 10px 15px;
      border-radius: 5px;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 10000;
    `;

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 384 512');
    icon.setAttribute('height', '20');
    icon.setAttribute('width', '20');
    icon.setAttribute('tabindex', '-1');
    icon.style.flexShrink = '0';
    icon.innerHTML = '<path fill="#fff" d="M192 0c-41.8 0-77.4 26.7-90.5 64H64C28.7 64 0 92.7 0 128V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64H282.5C269.4 26.7 233.8 0 192 0zm0 64a32 32 0 1 1 0 64 32 32 0 1 1 0-64zM305 273L177 401c-9.4 9.4-24.6 9.4-33.9 0L79 337c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L271 239c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"></path>';

    const text = document.createElement('div');
    text.dir = 'auto';
    text.className = 'css-146c3p1 r-jwli3a r-1i10wst r-1n0xq6e';
    text.textContent = message;

    const closeButton = document.createElement('div');
    closeButton.setAttribute('aria-label', 'Dismiss');
    closeButton.tabIndex = 0;
    closeButton.className = 'css-175oi2r r-1loqt21 r-1otgn73 r-1p0dtai r-1d2f490 r-u8s1d r-zchlnj r-ipm5af';
    closeButton.addEventListener('click', () => {
      notification.remove();
    });

    notification.appendChild(icon);
    notification.appendChild(text);
    notification.appendChild(closeButton);
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  function addQuoteButton(messageDiv) {
    if (messageDiv.querySelector('.quote-button')) return;

    const quoteButton = document.createElement('div');
    quoteButton.className = 'quote-button';
    quoteButton.innerHTML = `
      <svg fill="none" viewBox="0 0 24 24" width="20" height="20" style="color: rgb(174, 187, 201);">
        <path fill="currentColor" d="M13.22 19.03a.75.75 0 001.06 0l6.25-6.25a.75.75 0 000-1.06l-6.25-6.25a.75.75 0 10-1.06 1.06L18.19 11.5H6.75a.75.75 0 000 1.5h11.44l-4.97 4.97a.75.75 0 000 1.06z"/>
      </svg>
    `;

    quoteButton.style.cssText = `
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      opacity: 0;
      transition: opacity 0.2s;
      cursor: pointer;
      padding: 5px;
    `;

    const isRightAligned = messageDiv.style.alignSelf === 'flex-end';
    if (isRightAligned) {
      quoteButton.style.left = '-30px';
      quoteButton.style.transform = 'translateY(-50%) scaleX(-1)';
    } else {
      quoteButton.style.right = '-30px';
    }

    messageDiv.style.position = 'relative';
    messageDiv.addEventListener('mouseenter', () => {
      quoteButton.style.opacity = '1';
    });
    messageDiv.addEventListener('mouseleave', () => {
      quoteButton.style.opacity = '0';
    });

    quoteButton.addEventListener('click', () => {
      const textarea = document.querySelector('textarea[placeholder="Написать сообщение"]');
      if (textarea) {
        const messageText = messageDiv.querySelector('[data-word-wrap="1"]').textContent.trim();
        const lines = messageText.split('\n');
        const quotedText = lines.map(line => `> ${line}`).join('\n');

        const cursorPosition = textarea.selectionStart;
        const currentValue = textarea.value;
        const newValue = currentValue.slice(0, cursorPosition) + quotedText + '\n\n';
        textarea.value = newValue;

        const newCursorPosition = cursorPosition + quotedText.length + 2;
        textarea.setSelectionRange(newCursorPosition, newCursorPosition);
        adjustTextareaHeight(textarea);

        textarea.focus();
      }
    });

    messageDiv.appendChild(quoteButton);
  }

  function adjustTextareaHeight(textarea) {
    if (!textarea) return;

    const minHeight = 24;
    const maxHeight = 200;

    const scrollPos = textarea.scrollTop;
    textarea.style.height = 'auto';

    const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight));
    textarea.style.height = newHeight + 'px';

    textarea.scrollTop = scrollPos;

    const container = textarea.closest('.css-175oi2r[style*="flex-direction: row"]');
    if (container) {
      container.style.height = 'auto';
      container.style.height = (container.scrollHeight) + 'px';
    }
  }

  function setupTextareaListener() {
    const textarea = document.querySelector('textarea[placeholder="Написать сообщение"]');
    if (textarea) {
      const events = ['input', 'change', 'cut', 'paste', 'drop', 'keydown', 'keyup'];

      events.forEach(event => {
        textarea.addEventListener(event, () => {
          requestAnimationFrame(() => adjustTextareaHeight(textarea));
        });
      });

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            adjustTextareaHeight(textarea);
          }
        });
      });

      observer.observe(textarea, { attributes: true, attributeFilter: ['style'] });

      textarea.addEventListener('input', () => {
        if (textarea.value.trim() === '') {
          adjustTextareaHeight(textarea);
        }
      });

      adjustTextareaHeight(textarea);
    }
  }

  function addButtons() {
    const items = document.querySelectorAll('[data-testid^="feedItem"]:not(.enhanced), [data-testid^="postThreadItem"]:not(.enhanced)');
    items.forEach(item => {
      const postLink = item.querySelector('a[href*="/post/"]')?.href;
      if (!postLink) return;

      let actionsContainer;
      if (item.dataset.testid.startsWith('feedItem')) {
        actionsContainer = item.querySelector('[style*="justify-content: space-between"]');
      } else {
        actionsContainer = item.querySelector('.css-175oi2r[style*="flex-direction: row; justify-content: space-between"]');
      }
      if (!actionsContainer) return;

      const settingsContainer = actionsContainer.lastElementChild;
      if (!settingsContainer) return;
      if (item.querySelector('.copy-link-button')) return;

      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'css-175oi2r copy-link-button';
      buttonContainer.style.cssText = 'flex: 1 1 0%; align-items: flex-start;';

      const button = document.createElement('button');
      button.className = 'css-175oi2r r-1loqt21 r-1otgn73';
      button.style.cssText = 'padding: 5px; border-radius: 999px; display: flex; align-items: center; justify-content: center;';
      button.innerHTML = `
        <svg fill="none" width="18" height="18" viewBox="0 0 24 24" style="color: rgb(120, 142, 165); pointer-events: none;">
          <path fill="hsl(211, 20%, 56%)" fill-rule="evenodd" clip-rule="evenodd" d="M12.707 3.293a1 1 0 0 0-1.414 0l-4.5 4.5a1 1 0 0 0 1.414 1.414L11 6.414v8.836a1 1 0 1 0 2 0V6.414l2.793 2.793a1 1 0 1 0 1.414-1.414l-4.5-4.5ZM5 12.75a1 1 0 1 0-2 0V20a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-7.25a1 1 0 1 0-2 0V19H5V12.75Z"></path>
        </svg>
      `;

      button.addEventListener('click', e => {
        e.preventDefault();
        navigator.clipboard.writeText(postLink).then(() => {
          showNotification('Скопировано в буфер обмена');
        });
      });

      buttonContainer.appendChild(button);
      actionsContainer.insertBefore(buttonContainer, settingsContainer);
      item.classList.add('enhanced');
    });

    const messages = document.querySelectorAll('.css-175oi2r[style*="padding: 8px 14px"]:not(.quote-enhanced), .css-175oi2r[style*="align-self: flex-end"]:not(.quote-enhanced)');
    messages.forEach(message => {
      message.classList.add('quote-enhanced');
      addQuoteButton(message);
    });
  }

  function createToggleSwitch(id, label, onChange) {
    const container = document.createElement('div');
    container.className = 'css-175oi2r r-18u37iz';
    container.style.cssText = 'justify-content: space-between; align-items: center; padding: 8px 0;';

    const labelElement = document.createElement('span');
    labelElement.className = 'css-146c3p1';
    labelElement.style.cssText = 'color: rgb(174, 187, 201); font-size: 16px; letter-spacing: 0.15px; font-weight: 400;';
    labelElement.textContent = label;

    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'css-175oi2r r-1loqt21';
    toggleContainer.style.cssText = 'width: 44px; height: 24px; border-radius: 12px; margin-left: 135px; background-color: rgb(46, 64, 82); position: relative; transition: background-color 0.2s; cursor: pointer; margin-right: auto;';

    const toggleSwitch = document.createElement('div');
    toggleSwitch.className = 'css-175oi2r r-1loqt21';
    toggleSwitch.style.cssText = 'width: 20px; height: 20px; border-radius: 50%; background-color: rgb(174, 187, 201); position: absolute; top: 2px; left: 2px; transition: transform 0.2s;';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.style.display = 'none';

    toggleContainer.addEventListener('click', (e) => {
      e.preventDefault();
      checkbox.checked = !checkbox.checked;
      updateToggleState();
      onChange(checkbox.checked);
    });

    function updateToggleState() {
      if (checkbox.checked) {
        toggleContainer.style.backgroundColor = 'rgb(32, 139, 254)';
        toggleSwitch.style.transform = 'translateX(20px)';
        toggleSwitch.style.backgroundColor = 'white';
      } else {
        toggleContainer.style.backgroundColor = 'rgb(46, 64, 82)';
        toggleSwitch.style.transform = 'translateX(0)';
        toggleSwitch.style.backgroundColor = 'rgb(174, 187, 201)';
      }
    }

    toggleContainer.appendChild(toggleSwitch);
    toggleContainer.appendChild(checkbox);
    container.appendChild(labelElement);
    container.appendChild(toggleContainer);

    return container;
  }

  function getCurrentProfileHandle() {
    const profileUrl = window.location.pathname;
    const match = profileUrl.match(/\/profile\/([^/]+)/);
    return match ? match[1] : null;
  }

  function addEnhancerMenu() {
    if (document.querySelector('.bluesky-enhancer-menu')) {
      updateRepostToggleState();
      updateWorkButtonState();
      updateHideLikedPostsToggleState();
      return;
    }

    const menuContainer = document.querySelector('.css-175oi2r[style*="padding: 20px 0px 20px 28px"]');
    if (!menuContainer) {
      console.log('Menu container not found, retrying in 1 second');
      setTimeout(addEnhancerMenu, 1);
      return;
    }

    const enhancerMenu = document.createElement('div');
    enhancerMenu.className = 'css-175oi2r r-qklmqi r-5kkj8d r-le4sbl r-1444osr bluesky-enhancer-menu';
    enhancerMenu.style.cssText = 'border-color: rgb(46, 64, 82); margin-top: 16px; margin-bottom: 16px; user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none;';

    const title = document.createElement('div');
    title.className = 'css-175oi2r';
    title.style.cssText = 'padding-top: 16px; padding-bottom: 8px;';
    title.innerHTML = '<span class="css-146c3p1" style="color: rgb(174, 187, 201); font-size: 18px; letter-spacing: 0.15px; font-weight: 700;">Bluesky Enhancer</span>';

    enhancerMenu.appendChild(title);

    const repostToggleContainer = document.createElement('div');
    repostToggleContainer.id = 'repost-toggle-container';
    const repostToggle = createToggleSwitch('showReposts', 'Hide Reposts     ', (checked) => {
      console.log('Hide reposts:', checked);
      hideReposts(checked);
      hideRepostsEnabled = checked;
    });
    repostToggleContainer.appendChild(repostToggle);

    const hideLikedPostsToggleContainer = document.createElement('div');
    hideLikedPostsToggleContainer.id = 'hide-liked-posts-toggle-container';
    const hideLikedPostsToggle = createToggleSwitch('hideLikedPosts', 'Hide Liked Posts', (checked) => {
      console.log('Hide liked posts:', checked);
      hideLikedPosts(checked);
    });
    hideLikedPostsToggleContainer.appendChild(hideLikedPostsToggle);

    enhancerMenu.appendChild(hideLikedPostsToggleContainer);
    enhancerMenu.appendChild(repostToggleContainer);

    const workButtonContainer = document.createElement('div');
    workButtonContainer.id = 'work-button-container';
    workButtonContainer.style.display = 'flex';
    workButtonContainer.style.alignItems = 'center';
    workButtonContainer.style.justifyContent = 'space-between';
    workButtonContainer.style.marginTop = '8px';

    const startLikingText = document.createElement('span');
    startLikingText.textContent = 'Start liking';
    startLikingText.style.color = 'rgb(174, 187, 201)';
    startLikingText.style.fontSize = '14px';
    workButtonContainer.appendChild(startLikingText);

    const workButton = createWorkButton();
    workButtonContainer.appendChild(workButton);
    enhancerMenu.appendChild(workButtonContainer);

    menuContainer.insertBefore(enhancerMenu, menuContainer.lastElementChild);
    updateRepostToggleVisibility();
    updateHideLikedPostsToggleVisibility();
    updateWorkButtonVisibility();
  }

  function createWorkButton() {
    const button = document.createElement('button');
    button.id = 'work-button';
    button.className = 'css-175oi2r r-1loqt21 r-1otgn73';
    button.style.cssText = `
      padding: 8px 16px;
      border-radius: 9999px;
      font-size: 14px;
      font-weight: 600;
      color: white;
      background-color: rgb(32, 139, 254);
      border: none;
      cursor: pointer;
      transition: background-color 0.2s;
      margin-left: auto;
    `;
    button.textContent = 'Start';

    button.addEventListener('click', toggleWork);

    return button;
  }

  function toggleWork() {
    isWorking = !isWorking;
    updateWorkButtonState();
    if (isWorking) {
      startLikingPosts();
    }
  }

  function updateWorkButtonState() {
    const button = document.getElementById('work-button');
    if (button) {
      if (isWorking) {
        button.textContent = 'Stop';
        button.style.backgroundColor = 'white';
        button.style.color = 'rgb(32, 139, 254)';
      } else {
        button.textContent = 'Start';
        button.style.backgroundColor = 'rgb(32, 139, 254)';
        button.style.color = 'white';
      }
    }
  }

  async function startLikingPosts() {
    while (isWorking) {
      const posts = document.querySelectorAll('[data-testid^="feedItem"]:not(.liked):not(.repost)');
      let likedAnyPost = false;

      for (const post of posts) {
        if (!isWorking) break;
        const likeButton = post.querySelector('[data-testid="likeBtn"]');
        if (likeButton) {
          const isAlreadyLiked = likeButton.querySelector('svg[class="r-84gixx"]');
          if (!isAlreadyLiked) {
            likeButton.click();
            post.classList.add('liked');
            if (hideLikedPostsEnabled) {
              post.style.display = 'none';
            }
            likedAnyPost = true;
          } else {
            post.classList.add('liked');
          }
        }
      }

      if (!likedAnyPost) {
        if (isEndOfFeed()) {
          const lastPost = document.querySelector('[data-testid^="feedItem"]:last-of-type');
          if (lastPost) {
            const likeButton = lastPost.querySelector('[data-testid="likeBtn"]');
            if (likeButton && !likeButton.querySelector('svg[class="r-84gixx"]')) {
              likeButton.click();
            }
          }
          isWorking = false;
          updateWorkButtonState();
          alert('Reached the end of the feed and liked all posts. Stopping work.');
          break;
        } else {
          scrollToLoadMorePosts();
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
  }

  function continuouslyHideLikedPosts() {
    setInterval(() => {
      if (hideLikedPostsEnabled) {
        const allPosts = document.querySelectorAll('[data-testid^="feedItem"]');
        allPosts.forEach(post => {
          const likeButton = post.querySelector('[data-testid="likeBtn"]');
          const isLiked = likeButton && likeButton.querySelector('svg[class="r-84gixx"]');
          if (isLiked) {
            post.style.display = 'none';
          }
        });
      }
    }, 1);
  }

  function continuouslyHideReposts() {
    setInterval(() => {
      if (hideRepostsEnabled) {
        const allPosts = document.querySelectorAll('[data-testid^="feedItem"]');
        allPosts.forEach(post => {
          const isRepost = post.querySelector('[aria-label$="сделал(а) репост"]');
          if (isRepost) {
            post.style.display = 'none';
          }
        });
      }
    }, 1);
  }

  async function hideLikedPosts(hide) {
    hideLikedPostsEnabled = hide;
    const allPosts = document.querySelectorAll('[data-testid^="feedItem"]');
    allPosts.forEach(post => {
      const likeButton = post.querySelector('[data-testid="likeBtn"]');
      const isLiked = likeButton && likeButton.querySelector('svg[class="r-84gixx"]');
      if (isLiked) {
        post.style.display = hide ? 'none' : '';
      }
    });
  }

  function scrollToLoadMorePosts() {
    window.scrollTo(0, document.body.scrollHeight);
  }

  function isEndOfFeed() {
    return !!document.querySelector('.css-175oi2r[style*="min-height: 32px;"] .css-146c3p1[style*="text-align: center"]');
  }

  function updateRepostToggleState() {
    const repostToggle = document.querySelector('#showReposts');
    if (repostToggle) {
      repostToggle.checked = hideRepostsEnabled;
      const toggleContainer = repostToggle.closest('.css-175oi2r.r-1loqt21');
      if (toggleContainer) {
        if (hideRepostsEnabled) {
          toggleContainer.style.backgroundColor = 'rgb(32, 139, 254)';
          toggleContainer.querySelector('div').style.transform = 'translateX(20px)';
          toggleContainer.querySelector('div').style.backgroundColor = 'white';
        } else {
          toggleContainer.style.backgroundColor = 'rgb(46, 64, 82)';
          toggleContainer.querySelector('div').style.transform = 'translateX(0)';
          toggleContainer.querySelector('div').style.backgroundColor = 'rgb(174, 187, 201)';
        }
      }
    }
  }

  function updateHideLikedPostsToggleState() {
    const hideLikedPostsToggle = document.querySelector('#hideLikedPosts');
    if (hideLikedPostsToggle) {
      hideLikedPostsToggle.checked = hideLikedPostsEnabled;
      const toggleContainer = hideLikedPostsToggle.closest('.css-175oi2r.r-1loqt21');
      if (toggleContainer) {
        if (hideLikedPostsEnabled) {
          toggleContainer.style.backgroundColor = 'rgb(32, 139, 254)';
          toggleContainer.querySelector('div').style.transform = 'translateX(20px)';
          toggleContainer.querySelector('div').style.backgroundColor = 'white';
        } else {
          toggleContainer.style.backgroundColor = 'rgb(46, 64, 82)';
          toggleContainer.querySelector('div').style.transform = 'translateX(0)';
          toggleContainer.querySelector('div').style.backgroundColor = 'rgb(174, 187, 201)';
        }
      }
    }
  }

  function updateRepostToggleVisibility() {
    const repostToggleContainer = document.getElementById('repost-toggle-container');
    if (repostToggleContainer) {
      const isProfilePage = /^\/profile\/[^/]+\/?$/.test(window.location.pathname);
      const isPostPage = /^\/profile\/[^/]+\/post\/[^/]+\/?$/.test(window.location.pathname);
      if (isProfilePage || isPostPage) {
        repostToggleContainer.style.display = 'block';
        updateRepostToggleState();
      } else {
        repostToggleContainer.style.display = 'none';
      }
    }
  }

  function updateHideLikedPostsToggleVisibility() {
    const hideLikedPostsToggleContainer = document.getElementById('hide-liked-posts-toggle-container');
    updateElementVisibility(hideLikedPostsToggleContainer);
  }

  function updateWorkButtonVisibility() {
    const workButtonContainer = document.getElementById('work-button-container');
    updateElementVisibility(workButtonContainer);
  }

  function updateElementVisibility(element) {
    if (element) {
      const isProfilePage = /^\/profile\/[^/]+\/?$/.test(window.location.pathname);
      element.style.display = isProfilePage ? 'flex' : 'none';
    }
  }

  function hideReposts(hide) {
    hideRepostsEnabled = hide;
    const posts = document.querySelectorAll('[data-testid^="feedItem"]');
    posts.forEach(post => {
      const isRepost = post.querySelector('[aria-label$="сделал(а) репост"]');
      if (isRepost) {
        post.style.display = hide ? 'none' : '';
      }
    });
  }

  function enhancePosts() {
    throttle(() => {
      addButtons();
      addEnhancerMenu();
      updateRepostToggleVisibility();
      updateHideLikedPostsToggleState();
      markReposts();
    });
  }

  function markReposts() {
    const posts = document.querySelectorAll('[data-testid^="feedItem"]');
    posts.forEach(post => {
      const isRepost = post.querySelector('[aria-label$="сделал(а) репост"]');
      if (isRepost) {
        post.classList.add('repost');
      }
    });
  }

  function observePosts() {
    const appRoot = document.querySelector('#root');
    if (appRoot) {
      const observer = new MutationObserver((mutations) => {
        if (mutations.some(mutation => mutation.addedNodes.length > 0)) {
          enhancePosts();
        }
      });
      observer.observe(appRoot, { childList: true, subtree: true });
    } else {
      console.log('App root not found, retrying in 1 second');
      setTimeout(observePosts, 1000);
    }
  }

  function observeURLChanges() {
    let lastUrl = location.href;
    let lastProfile = getCurrentProfileHandle();
    new MutationObserver(() => {
      const url = location.href;
      const currentProfile = getCurrentProfileHandle();
      if (url !== lastUrl || currentProfile !== lastProfile) {
        lastUrl = url;
        lastProfile = currentProfile;
        setTimeout(() => {
          updateRepostToggleVisibility();
          updateHideLikedPostsToggleVisibility();
          updateWorkButtonVisibility();
          if (currentProfile) {
            updateRepostToggleState();
            updateHideLikedPostsToggleState();
            updateWorkButtonState();
          }
          if (hideLikedPostsEnabled) {
            hideLikedPosts(true);
          }
        }, 1);
      }
    }).observe(document, {subtree: true, childList: true});
  }

  function setupHotkeys() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.ctrlKey && e.key === 'ArrowUp') {
        e.preventDefault();
        const homeLink = document.querySelector('a[href="/"][aria-label="Главная"]');
        if (homeLink) homeLink.click();
      } else if (e.ctrlKey && e.key === 'ArrowDown') {
        e.preventDefault();
        const messagesLink = document.querySelector('a[href="/messages"][aria-label="Чат"]');
        if (messagesLink) messagesLink.click();
      }
    }, true);
  }

  function init() {
    observePosts();
    observeURLChanges();
    enhancePosts();
    setupHotkeys();
    setupTextareaListener();
    continuouslyHideLikedPosts();
    continuouslyHideReposts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
