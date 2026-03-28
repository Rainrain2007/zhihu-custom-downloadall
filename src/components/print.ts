import { store } from '../store';
import { createButtonFontSize12, dom, domC, insertAfter, myStorage } from '../tools';
import { INNER_CSS } from '../web-resources';

const loadIframePrint = (eventBtn: HTMLButtonElement, arrHTML: string[], btnText: string) => {
  let max = 0;
  let finish = 0;
  let error = 0;
  const innerHTML = arrHTML.join('');

  const iframe = dom('.ctz-pdf-box-content') as HTMLIFrameElement;
  if (!iframe.contentWindow) return;
  const doc = iframe.contentWindow.document;
  doc.body.innerHTML = '';
  if (!doc.head.querySelector('style')) {
    doc.write(`<style type="text/css" id="ctz-css-own">${INNER_CSS}</style>`);
  }
  doc.write(`<div class="ctz-pdf-view"></div>`);
  const nodePDFView = doc.querySelector('.ctz-pdf-view')!;
  const domInner = domC('div', { innerHTML });
  max = domInner.querySelectorAll('img').length;
  domInner.querySelectorAll('img').forEach((imageItem) => {
    // 先将图片内容设置为空
    const dataOriginal = imageItem.getAttribute('data-original');
    if (!dataOriginal) {
      imageItem.setAttribute('data-original', imageItem.src);
    }
    imageItem.src = '';
  });
  nodePDFView.appendChild(domInner);

  const doPrint = () => {
    eventBtn.innerText = btnText;
    eventBtn.disabled = false;
    iframe.contentWindow!.print();
  };
  const imageLoaded = () => {
    eventBtn.innerText = `资源加载进度 ${Math.floor((finish / max) * 100)}%：${finish}/${max}${error > 0 ? `，${error}张图片资源已失效` : ''}`;
    if (finish + error === max) {
      doPrint();
    }
  };
  if (nodePDFView.querySelectorAll('img').length) {
    nodePDFView.querySelectorAll('img').forEach((imageItem, index) => {
      setTimeout(function () {
        imageItem.src = imageItem.getAttribute('data-original')!;
        imageItem.onload = function () {
          finish++;
          imageLoaded();
        };
        imageItem.onerror = function () {
          error++;
          imageLoaded();
        };
      }, Math.floor(index / 5) * 100); // 100ms加载6张图片一组加载，一次性加载太多会拦截
    });
  } else {
    doPrint();
  }
};

/** 收藏夹打印 */
export const myCollectionExport = {
  init: async function () {
    const { fetchInterceptStatus } = await myStorage.getConfig();
    if (!fetchInterceptStatus) return;
    const { pathname } = location;
    const elementBox = domC('div', { className: `${this.className}`, innerHTML: this.element });
    const nodeThis = dom(`.${this.className}`);
    nodeThis && nodeThis.remove();
    const elementTypeSpan = this.elementTypeSpan;
    const nodeCollection = elementBox.querySelector('[name="ctz-export-collection"]') as HTMLButtonElement;
    nodeCollection &&
      (nodeCollection.onclick = function () {
        const me = this as HTMLButtonElement;
        me.innerText = '加载中...';
        me.disabled = true;
        const matched = pathname.match(/(?<=\/collection\/)\d+/);
        const id = matched ? matched[0] : '';
        if (!id) return;
        const nodeCurrent = dom('.Pagination .PaginationButton--current');
        const offset = 20 * (nodeCurrent ? Number(nodeCurrent.innerText) - 1 : 0);
        const fetchHeaders = store.getFetchHeaders();

        fetch(`/api/v4/collections/${id}/items?offset=${offset}&limit=20`, {
          method: 'GET',
          headers: new Headers(fetchHeaders),
        })
          .then((response) => {
            return response.json();
          })
          .then((res) => {
            // 收藏夹数据返回内容
            const collectionsHTMLMap = (res.data || []).map((item: any) => {
              const { type, url, question, content, title } = item.content;
              switch (type) {
                case 'zvideo':
                  return (
                    `<div class="ctz-pdf-dialog-item">` +
                    `<div class="ctz-pdf-dialog-title">${elementTypeSpan(type)}${title}</div>` +
                    `<div>视频链接：<a href="${url}" target="_blank">${url}</a></div>` +
                    `</div>`
                  );
                case 'answer':
                case 'article':
                default:
                  return (
                    `<div class="ctz-pdf-dialog-item">` +
                    `<div class="ctz-pdf-dialog-title">${elementTypeSpan(type)}${title || question.title}</div>` +
                    `<div>内容链接：<a href="${url}" target="_blank">${url}</a></div>` +
                    `<div>${content}</div>` +
                    `</div>`
                  );
              }
            });
            loadIframePrint(me, collectionsHTMLMap, '导出此页内容');
          });
      });

    const nodePageHeaderTitle = dom('.CollectionDetailPageHeader-title');
    nodePageHeaderTitle && nodePageHeaderTitle.appendChild(elementBox);
  },
  className: 'ctz-export-collection-box',
  element: `<button class="ctz-button" name="ctz-export-collection">导出此页内容</button>` + `<p>仅对此页内容进行导出</p>`,
  elementTypeSpan: (type: string) => {
    const typeObj: Record<string, string> = {
      answer: '<b style="color: #ec7259">「问题」</b>',
      zvideo: '<b style="color: #12c2e9">「视频」</b>',
      article: '<b style="color: #00965e">「文章」</b>',
    };
    return typeObj[type] || '';
  },
};

/** 导出当前回答 */
export const printAnswer = (contentItem: HTMLElement) => {
  const boxItem = (contentItem.classList.contains('AnswerItem') ? contentItem.parentElement : contentItem) as HTMLElement;
  const prevButton = boxItem.querySelector('.ctz-answer-print');
  if (prevButton) return;
  const nodeUser = boxItem.querySelector('.AnswerItem-authorInfo>.AuthorInfo');
  if (!nodeUser) return;
  const nButton = createButtonFontSize12('导出回答', 'ctz-answer-print');
  nButton.onclick = function () {
    const nodeUser = boxItem.querySelector('.AuthorInfo-name .UserLink-link');
    const nodeContent = boxItem.querySelector('.RichContent-inner');
    const innerHTML = `<h1>${JSON.parse(boxItem.querySelector('.AnswerItem')!.getAttribute('data-zop') || '{}').title}</h1>${nodeUser!.outerHTML + nodeContent!.innerHTML}`;
    loadIframePrint(this as HTMLButtonElement, [innerHTML], '导出回答');
  };
  nodeUser.appendChild(nButton);
};

/** 导出当前文章 */
export const printArticle = async (contentItem: HTMLElement) => {
  const { topExportContent } = await myStorage.getConfig();
  const prevButton = contentItem.querySelector('.ctz-article-print');
  if (prevButton || !topExportContent) return;
  const nodeHeader = contentItem.querySelector('.ArticleItem-authorInfo') || contentItem.querySelector('.Post-Header .Post-Title');
  if (!nodeHeader) return;
  const nButton = createButtonFontSize12('导出文章', 'ctz-article-print', { style: 'margin: 12px 0;' });
  nButton.onclick = function () {
    const nodeTitle = contentItem.querySelector('.ContentItem-title>span') || contentItem.querySelector('.Post-Header .Post-Title');
    const nodeUser = contentItem.querySelector('.AuthorInfo-name');
    const nodeContent = contentItem.querySelector('.RichContent-inner') || contentItem.querySelector('.Post-RichTextContainer');
    const innerHTML = `<h1>${nodeTitle!.innerHTML}</h1>${nodeUser!.innerHTML + nodeContent!.innerHTML}`;
    loadIframePrint(this as HTMLButtonElement, [innerHTML], '导出文章');
  };
  insertAfter(nButton, nodeHeader);
  setTimeout(() => {
    // 是为了解决页面内容被刷新的掉的问题
    printArticle(contentItem);
  }, 500);
};

/** 用户主页 - 导出此页回答 */
export const printPeopleAnswer = async () => {
  const { fetchInterceptStatus } = await myStorage.getConfig();
  const nodeListHeader = dom('.Profile-main .List-headerText');
  const prevButton = dom(`.ctz-people-answer-print`);
  if (!nodeListHeader || prevButton || !fetchInterceptStatus) return;

  // 1. 原有的“导出此页”按钮
  const nButton = createButtonFontSize12('导出已抓取全部回答', 'ctz-people-answer-print');
  nButton.onclick = async function () {
    const eventBtn = this as HTMLButtonElement;
    const data = store.getUserAnswer();
    if (data.length === 0) {
      alert('尚未抓取到任何回答，请尝试向下滚动页面。');
      return;
    }
    eventBtn.innerText = `正在生成(${data.length}条)...`;
    eventBtn.disabled = true;
    const content = data.map((item) => {
      const created = new Date(item.created_time * 1000).toLocaleString();
      const updated = new Date(item.updated_time * 1000).toLocaleString();
      const timeLine = `<div style="color: #888; font-size: 12px; margin-bottom: 10px; background: #f5f5f5; padding: 5px 10px; border-radius: 4px;">
        📅 发布于: ${created} ${updated !== created ? ` | ✏️ 最后编辑于: ${updated}` : ''}
      </div>`;
      return `<h1>${item.question.title}</h1>${timeLine}<div>${item.content}</div>`;
    });
    loadIframePrint(eventBtn, content, '导出已抓取全部回答');
  };
  nodeListHeader.appendChild(nButton);

  // 2. 自动翻页按钮 (循环逻辑：获取 -> 存储 -> 翻页)
  const autoButton = createButtonFontSize12('🚀 开启全量自动合并抓取', 'ctz-auto-scroll-print', { style: 'margin-left: 10px;' });
  autoButton.onclick = async function () {
    const me = this as HTMLButtonElement;
    if (me.getAttribute('data-running') === 'true') {
        me.setAttribute('data-running', 'false');
        me.innerText = '正在停止...';
        return;
    }

    me.setAttribute('data-running', 'true');
    me.disabled = false; // 保持可点击以用于停止
    
    while (me.getAttribute('data-running') === 'true') {
        const currentCount = store.getUserAnswer().length + store.getUserArticle().length;
        me.innerText = `⏳ 抓取中... (已存 ${currentCount} 条)`;
        console.log(`[Engine] 当前已存储 ${currentCount} 条，准备加载下一波...`);
        
        // 强制大跨度滚动以确保按钮进入视口或触发懒加载
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise(r => setTimeout(r, 1000));
        window.scrollBy(0, -200); 
        await new Promise(r => setTimeout(r, 1000));

        // 尝试寻找“下一页”按钮，支持多种选择器以防变动
        let nextBtn = (document.querySelector('.PaginationButton-next') || 
                      document.querySelector('button.PaginationButton:last-child')) as HTMLButtonElement;

        if (nextBtn && !nextBtn.disabled && (nextBtn.innerText.includes('下一页') || nextBtn.querySelector('svg'))) {
            console.log('[Engine] 发现翻页按钮，执行点击...');
            nextBtn.click();
            
            // 记录下点击后的 URL 或第一条内容，用来判断翻页是否成功
            const oldUrl = window.location.href;
            const oldFirstId = document.querySelector('.List-item')?.getAttribute('data-zop');

            // 智能等待：优先等数据增加，实在不行等页面变动
            let waitTime = 0;
            let pageChanged = false;
            const MAX_WAIT = 40; // 增加到 40 次尝试，约 80 秒
            while (waitTime < MAX_WAIT && me.getAttribute('data-running') === 'true') {
                await new Promise(r => setTimeout(r, 2000)); // 每次等 2 秒
                const newCount = store.getUserAnswer().length + store.getUserArticle().length;
                const newFirstId = document.querySelector('.List-item')?.getAttribute('data-zop');
                
                if (newCount > currentCount) {
                    console.log(`[Engine] 成功抓取新内容！(+${newCount - currentCount})`);
                    pageChanged = true;
                    break;
                }
                
                // 如果过了 10 次还没动静，尝试补点一下
                if (waitTime === 10 || waitTime === 25) {
                    console.log('[Engine] 等待较久，尝试再次补点下一页按钮...');
                    const retryBtn = (document.querySelector('.PaginationButton-next') || 
                                     document.querySelector('button.PaginationButton:last-child')) as HTMLButtonElement;
                    if (retryBtn && !retryBtn.disabled) retryBtn.click();
                }
                
                waitTime++;
                me.innerText = `⏳ 等待响应... ${waitTime}/${MAX_WAIT} (已存 ${currentCount})`;
            }
            
            if (!pageChanged && me.getAttribute('data-running') === 'true') {
                console.log('[Engine] 响应超时，尝试再次触发滚动加载...');
                window.scrollTo(0, document.body.scrollHeight);
            }
        } else {
            console.log('[Engine] 找不到翻页按钮，可能已到末尾。尝试最后一次强行滚动...');
            window.scrollTo(0, document.body.scrollHeight);
            await new Promise(r => setTimeout(r, 3000));
            if (store.getUserAnswer().length + store.getUserArticle().length === currentCount) {
                console.log('[Engine] 确实到底了。');
                break;
            }
        }
    }
    
    const finalCount = store.getUserAnswer().length + store.getUserArticle().length;
    me.setAttribute('data-running', 'false');
    me.innerText = `🚀 再次开启自动合并 (已存 ${finalCount})`;
    me.disabled = false;
    alert(`全量抓取阶段结束！共收集 ${finalCount} 条内容。`);
  };
  nodeListHeader.appendChild(autoButton);

  setTimeout(() => {
    printPeopleAnswer();
  }, 500);
};

/** 当前用户文章导出为PDF */
export const printPeopleArticles = async () => {
  const { fetchInterceptStatus } = await myStorage.getConfig();
  const nodeListHeader = dom('.Profile-main .List-headerText');
  const prevButton = dom('.ctz-people-article-print');
  if (!nodeListHeader || prevButton || !fetchInterceptStatus) return;

  // 1. 原有的“导出此页”按钮
  const nButton = createButtonFontSize12('导出已抓取全部文章', 'ctz-people-article-print');
  nButton.onclick = async function () {
    const eventBtn = this as HTMLButtonElement;
    const data = store.getUserArticle();
    if (data.length === 0) {
      alert('尚未抓取到任何文章，请尝试向下滚动页面。');
      return;
    }
    eventBtn.innerText = `正在生成(${data.length}条)...`;
    eventBtn.disabled = true;
    const content = data.map((item) => {
      const created = new Date(item.created * 1000).toLocaleString();
      const updated = new Date(item.updated * 1000).toLocaleString();
      const timeLine = `<div style="color: #888; font-size: 12px; margin-bottom: 10px; background: #f5f5f5; padding: 5px 10px; border-radius: 4px;">
        📅 发布于: ${created} ${updated !== created ? ` | ✏️ 最后编辑于: ${updated}` : ''}
      </div>`;
      return `<h1>${item.title}</h1>${timeLine}<div>${item.content}</div>`;
    });
    loadIframePrint(eventBtn, content, '导出已抓取全部文章');
  };
  nodeListHeader.appendChild(nButton);

  // 2. 自动翻页按钮
  const autoButton = createButtonFontSize12('🚀 开启全量自动合并抓取', 'ctz-auto-scroll-article-print', { style: 'margin-left: 10px;' });
  autoButton.onclick = async function () {
    const me = this as HTMLButtonElement;
    if (me.getAttribute('data-running') === 'true') {
        me.setAttribute('data-running', 'false');
        me.innerText = '正在停止...';
        return;
    }

    me.setAttribute('data-running', 'true');
    me.disabled = false;
    
    while (me.getAttribute('data-running') === 'true') {
        const currentCount = store.getUserArticle().length;
        me.innerText = `⏳ 抓取中... (已存 ${currentCount} 条)`;
        
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise(r => setTimeout(r, 1000));
        window.scrollBy(0, -200); 
        await new Promise(r => setTimeout(r, 1000));

        let nextBtn = (document.querySelector('.PaginationButton-next') || 
                      document.querySelector('button.PaginationButton:last-child')) as HTMLButtonElement;

        if (nextBtn && !nextBtn.disabled && (nextBtn.innerText.includes('下一页') || nextBtn.querySelector('svg'))) {
            nextBtn.click();
            let waitTime = 0;
            let pageChanged = false;
            const MAX_WAIT = 40;
            while (waitTime < MAX_WAIT && me.getAttribute('data-running') === 'true') {
                await new Promise(r => setTimeout(r, 2000));
                const newCount = store.getUserArticle().length;
                if (newCount > currentCount) {
                    pageChanged = true;
                    break;
                }
                if (waitTime === 10 || waitTime === 25) {
                    const retryBtn = (document.querySelector('.PaginationButton-next') || 
                                     document.querySelector('button.PaginationButton:last-child')) as HTMLButtonElement;
                    if (retryBtn && !retryBtn.disabled) retryBtn.click();
                }
                waitTime++;
                me.innerText = `⏳ 等待响应... ${waitTime}/${MAX_WAIT} (已存 ${currentCount})`;
            }
            if (!pageChanged && me.getAttribute('data-running') === 'true') {
                window.scrollTo(0, document.body.scrollHeight);
            }
        } else {
            window.scrollTo(0, document.body.scrollHeight);
            await new Promise(r => setTimeout(r, 3000));
            if (store.getUserArticle().length === currentCount) break;
        }
    }
    
    const finalCount = store.getUserArticle().length;
    me.setAttribute('data-running', 'false');
    me.innerText = `🚀 再次开启自动合并 (已存 ${finalCount})`;
    alert(`全量抓取阶段结束！共收集 ${finalCount} 条内容。`);
  };
  nodeListHeader.appendChild(autoButton);

  setTimeout(() => {
    printPeopleArticles();
  }, 500);
};

/** 当前用户想法导出为PDF */
export const printPeoplePins = async () => {
  const { fetchInterceptStatus } = await myStorage.getConfig();
  const nodeListHeader = dom('.Profile-main .List-headerText');
  const prevButton = dom('.ctz-people-pin-print');
  if (!nodeListHeader || prevButton || !fetchInterceptStatus) return;

  const nButton = createButtonFontSize12('导出已抓取全部想法', 'ctz-people-pin-print');
  nButton.onclick = async function () {
    const eventBtn = this as HTMLButtonElement;
    const data = store.getUserPin();
    if (data.length === 0) {
      alert('尚未抓取到任何想法，请尝试向下滚动页面。');
      return;
    }
    eventBtn.innerText = `正在生成(${data.length}条)...`;
    eventBtn.disabled = true;
    const content = data.map((item) => {
      const timeStamp = item.created || item.created_time || 0;
      const created = timeStamp ? new Date(timeStamp * 1000).toLocaleString() : '未知时间';
      const timeLine = `<div style="color: #888; font-size: 12px; margin-bottom: 10px; background: #f5f5f5; padding: 5px 10px; border-radius: 4px;">
        📅 发布于: ${created}
      </div>`;
      
      let pinContent = '';
      const rawContent = item.content || item.excerpt || '';
      if (Array.isArray(rawContent)) {
          pinContent = rawContent.map((c: any) => {
              if (c.type === 'text') return c.content || c.text || '';
              if (c.type === 'image') return `<img src="${c.url || c.data_url}" style="max-width: 100%; display: block; margin: 10px 0;">`;
              if (c.type === 'video') return `[视频内容]`;
              if (c.type === 'link') return `<a href="${c.url}" target="_blank">${c.title || c.url}</a>`;
              return '';
          }).join('<br>');
      } else {
          pinContent = rawContent;
      }
      return `<div style="border-bottom: 1px solid #eee; padding-bottom: 20px; margin-bottom: 20px;">${timeLine}<div>${pinContent}</div></div>`;
    });
    loadIframePrint(eventBtn, content, '导出已抓取全部想法');
  };
  nodeListHeader.appendChild(nButton);

  const autoButton = createButtonFontSize12('🚀 开启全量自动合并抓取', 'ctz-auto-scroll-pin-print', { style: 'margin-left: 10px;' });
  autoButton.onclick = async function () {
    const me = this as HTMLButtonElement;
    if (me.getAttribute('data-running') === 'true') {
        me.setAttribute('data-running', 'false');
        me.innerText = '正在停止...';
        return;
    }

    me.setAttribute('data-running', 'true');
    me.disabled = false;
    
    while (me.getAttribute('data-running') === 'true') {
        const currentCount = store.getUserPin().length;
        me.innerText = `⏳ 抓取中... (已存 ${currentCount} 条)`;
        
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise(r => setTimeout(r, 1000));
        window.scrollBy(0, -200); 
        await new Promise(r => setTimeout(r, 500));

        let nextBtn = (document.querySelector('.PaginationButton-next') || 
                      document.querySelector('button.PaginationButton:last-child')) as HTMLButtonElement;

        if (nextBtn && !nextBtn.disabled && (nextBtn.innerText.includes('下一页') || nextBtn.querySelector('svg'))) {
            nextBtn.click();
            let waitTime = 0;
            let pageChanged = false;
            const MAX_WAIT = 40;
            while (waitTime < MAX_WAIT && me.getAttribute('data-running') === 'true') {
                await new Promise(r => setTimeout(r, 2000));
                const newCount = store.getUserPin().length;
                if (newCount > currentCount) {
                    pageChanged = true;
                    break;
                }
                if (waitTime === 10 || waitTime === 25) {
                    const retryBtn = (document.querySelector('.PaginationButton-next') || 
                                     document.querySelector('button.PaginationButton:last-child')) as HTMLButtonElement;
                    if (retryBtn && !retryBtn.disabled) retryBtn.click();
                }
                waitTime++;
                me.innerText = `⏳ 等待响应... ${waitTime}/${MAX_WAIT} (已存 ${currentCount})`;
            }
        } else {
            window.scrollTo(0, document.body.scrollHeight);
            await new Promise(r => setTimeout(r, 3000));
            if (store.getUserPin().length === currentCount) break;
        }
    }
    
    const finalCount = store.getUserPin().length;
    me.setAttribute('data-running', 'false');
    me.innerText = `🚀 再次开启自动合并 (已存 ${finalCount})`;
    alert(`全量抓取阶段结束！共收集 ${finalCount} 条想法。`);
  };
  nodeListHeader.appendChild(autoButton);

  setTimeout(() => {
    printPeoplePins();
  }, 500);
};
