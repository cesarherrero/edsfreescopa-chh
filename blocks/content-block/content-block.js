/*
 * Content Block: port of the AEM component cti-commons/components/content-block
 * (ContentBlock model + variants/*.html). Same contributable fields (key-value rows, one per
 * field; videos as child rows "url | label") and the same markup, atom wrappers included, so
 * the cti-commons stylesheet (legacy/_clv-wem-bk.scss, _content-block.scss) applies as is.
 */
import { toClassName } from '../../scripts/aem.js';
import { isSameOriginImage, moveInstrumentation } from '../../scripts/scripts.js';

const TYPES = ['image', 'centered', 'video', 'video-dist', 'form'];
const LEVELS = ['1', '2', '3', '4', '5', '6'];
const SIZES = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

// Style System of the Title policy (conf/cti-commons/settings/wcm/policies, "Content Title")
const TITLE_VARIANTS = ['title--secondary'];
const TITLE_LINE_COLORS = ['title--cyan', 'title--yellow', 'title--gray-business', 'title--gray-dark',
  'title--bkj-yellow', 'title--bkj-turquoise', 'title--bkj-blue', 'title--ca-grey-input',
  'title--bki-green', 'title--bki-orange'];

const IMAGE_STYLES = {
  standard: '',
  'top-right': 'content-block_image-top-right',
  in: 'content-block_image-in',
  out: 'content-block_image-out',
};

// {side} is the side of the image
const IMAGE_VARIANTS = {
  standard: '',
  square: 'content-block--square-{side}',
  ca: 'content-block--ca',
  bki: 'content-block--bki',
  'bki-slim': 'content-block--bki content-block--bki-slim',
  sticky: 'content-block--sticky',
  'bkj-double-square': 'bkj-double-square-{side}',
  'banner-bkj': 'banner-bkj',
  'banner-bkj-mini': 'banner-bkj-mini',
  'banner-bkj-main': 'banner-bkj-main',
};

const COLUMNS = ['8-4', '7-4', '7-5', '6-5', '5-6', '5-7'];

const BRAND_COLORS = ['bkj-yellow', 'bkj-turquoise', 'bkj-blue', 'bkj-red',
  'bki-green', 'bki-orange', 'ca-grey-dark', 'ca-grey-input'];

// Per type: accepted colours, default colour, margins of the block and classes of the title wrapper
const DEFAULTS = {
  image: {
    colors: ['orange', 'yellow', 'cyan', 'green', 'gray-business', ...BRAND_COLORS],
    color: null,
    spacing: 'margin-bottom_104',
    titleClass: 'mb-24',
  },
  centered: {
    colors: [],
    color: null,
    spacing: 'margin-bottom_64',
    titleClass: 'mb-24 mb-sm-40',
  },
  video: {
    colors: ['orange', 'yellow', 'cyan', 'green', 'gray-business', 'gray-dark', ...BRAND_COLORS],
    color: 'orange',
    spacing: 'margin-bottom_40',
    titleClass: 'mb-24',
  },
  'video-dist': {
    colors: ['yellow', 'cyan', 'gray-business', ...BRAND_COLORS],
    color: 'yellow',
    spacing: 'margin-bottom_104 margin-bottom_40-xs margin-top_32',
    titleClass: '',
  },
  form: {
    colors: ['yellow', 'cyan'],
    color: 'yellow',
    spacing: 'mb-40 mb-sm-104',
    titleClass: 'mb-24',
  },
};

const LINK_FIELDS = (name) => [name, `${name}Text`, `${name}NewTab`, `${name}Icon`, `${name}AccessibilityLabel`];

const FIELDS = [
  'type', 'imagePosition', 'imageStyle', 'columns', 'imageVariant', 'linkStyle', 'color',
  'watermark', 'watermarkSmall', 'id',
  'title', 'titleType', 'titleLevel', 'titleDescriptor', 'titleDescriptorLevel', 'titleDescriptorSize',
  'titleSubtitle', 'titleStandfirst', 'titleShowLine', 'titleId', 'titleVariant', 'titleLineColor',
  'standfirst', 'text', 'description',
  'image', 'imageAlt', 'imageTitle', 'imageDisplayPopupTitle', 'imageLink', 'imageLinkNewTab',
  ...LINK_FIELDS('primaryLink'), ...LINK_FIELDS('secondaryLink'),
  'form',
];

const YOUTUBE_ID = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/;
const YOUTUBE_LIST = /[?&]list=([A-Za-z0-9_-]+)/;
const BARE_ID = /^[A-Za-z0-9_-]{6,20}$/;
const YOUTUBE_EMBED = 'https://www.youtube.com/embed/';
const YOUTUBE_PARAMS = 'rel=0&controls=1&modestbranding=0&color=white';

const IS_UE = /\.(stage-ue|ue)\.da\.live$/.test(window.location.hostname);

let blockCount = 0;

const cls = (...values) => values.filter((v) => v && v.trim()).map((v) => v.trim()).join(' ');

const oneOf = (value, allowed, fallback) => (value && allowed.includes(value) ? value : fallback);

/** null/false/'' attributes are skipped, true renders an empty attribute (as HTL). */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([name, value]) => {
    if (value === true) node.setAttribute(name, '');
    else if (value !== null && value !== undefined && value !== false && value !== '') {
      node.setAttribute(name, value);
    }
  });
  node.append(...children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false && c !== ''));
  return node;
}

function safeUrl(value) {
  const url = (value || '').trim();
  if (!url) return '';
  try {
    const { protocol } = new URL(url, window.location.href);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(protocol) ? url : '';
  } catch (e) {
    return '';
  }
}

/** YouTube embed URL for a watch/short/embed/playlist URL or a video id; other https as is. */
function embedUrl(value) {
  const url = (value || '').trim();
  if (!url) return null;
  const id = url.match(YOUTUBE_ID);
  if (id) return `${YOUTUBE_EMBED}${id[1]}?${YOUTUBE_PARAMS}`;
  const list = url.match(YOUTUBE_LIST);
  if (list) return `${YOUTUBE_EMBED}videoseries?list=${list[1]}&${YOUTUBE_PARAMS}`;
  if (BARE_ID.test(url)) return `${YOUTUBE_EMBED}${url}?${YOUTUBE_PARAMS}`;
  return url.startsWith('https://') ? url : null;
}

/** Splits the block rows into field cells (key | value) and video child rows (url | label). */
function readRows(block) {
  const keys = new Map(FIELDS.map((name) => [toClassName(name), name]));
  const cells = {};
  const videoRows = [];
  [...block.children].forEach((row) => {
    const [key, value] = row.children;
    const name = key && keys.get(toClassName(key.textContent));
    if (name) cells[name] = value;
    else if (key) videoRows.push(row);
  });
  return { cells, videoRows };
}

function createFields(cells) {
  const value = (name) => (cells[name]?.textContent || '').trim();
  const flag = (name) => value(name).toLowerCase() === 'true';
  const href = (name) => cells[name]?.querySelector('a[href]')?.getAttribute('href') || value(name);
  const hasRich = (name) => !!cells[name] && (value(name) !== '' || !!cells[name].querySelector('img'));

  /** Moves the rich content out of the cell; inline unwraps a single paragraph (title). */
  const rich = (name, inline) => {
    const cell = cells[name];
    if (!hasRich(name)) return null;
    const only = cell.firstElementChild;
    const single = only && cell.children.length === 1 && /^(P|H[1-6])$/.test(only.tagName)
      && [...cell.childNodes].every((n) => n === only || !n.textContent.trim());
    const fragment = document.createDocumentFragment();
    fragment.append(...(inline && single ? only.childNodes : cell.childNodes));
    return fragment;
  };

  const imageSource = () => {
    const cell = cells.image;
    if (!cell) return null;
    const img = cell.querySelector('img');
    const src = safeUrl(img?.getAttribute('src') || href('image'));
    if (!src) return null;
    const absolute = new URL(src, window.location.href).href;
    const result = { img, width: img?.getAttribute('width'), height: img?.getAttribute('height') };
    if (!isSameOriginImage(absolute)) return { ...result, src: absolute };
    const { pathname } = new URL(absolute);
    const url = (width) => `${pathname}?width=${width}&format=webply&optimize=medium`;
    return {
      ...result,
      src: url(750),
      srcset: [400, 750, 1200, 2000].map((w) => `${url(w)} ${w}w`).join(', '),
    };
  };

  return {
    cells, value, flag, href, hasRich, rich, imageSource,
  };
}

/** Atoms (templates/atoms.html): Title, Text, Image and Button, inside their AEM wrapper. */
function createAtoms(f) {
  return {
    title(wrapperClass) {
      if (!f.value('title')) return null;
      const level = oneOf(f.value('titleLevel'), LEVELS, '2');
      const descriptor = f.value('titleDescriptor');
      const descriptorLevel = oneOf(f.value('titleDescriptorLevel'), [...LEVELS, 'p'], '1');
      const subtitle = f.rich('titleSubtitle');
      const standfirst = f.rich('titleStandfirst');
      const heading = el(`h${level}`, { class: cls('section-heading__title', oneOf(f.value('titleType'), SIZES, '')) }, f.rich('title', true));
      moveInstrumentation(f.cells.title, heading);
      return el(
        'div',
        {
          class: cls(
            'title',
            oneOf(f.value('titleVariant'), TITLE_VARIANTS, ''),
            oneOf(f.value('titleLineColor'), TITLE_LINE_COLORS, ''),
            wrapperClass,
          ),
        },
        el(
          'div',
          { id: f.value('titleId'), class: 'section-heading' },
          descriptor ? el(
            descriptorLevel === 'p' ? 'p' : `h${descriptorLevel}`,
            { class: cls('section-heading__descriptor text-uppercase', oneOf(f.value('titleDescriptorSize'), SIZES, 'h6'), 'mb-24') },
            descriptor,
          ) : null,
          heading,
          subtitle ? el('div', { class: 'section-heading__description' }, subtitle) : null,
          f.flag('titleShowLine') ? el('div', { class: 'section-heading__line', 'aria-hidden': 'true' }) : null,
          standfirst ? el('div', { class: 'mt-24' }, standfirst) : null,
        ),
      );
    },

    text(name, wrapperClass, bullets) {
      const cell = f.cells[name];
      const content = f.rich(name);
      if (!content) return null;
      if (bullets) {
        content.querySelectorAll('ul').forEach((ul) => {
          if (!ul.attributes.length) ul.className = 'list_bullets';
        });
      }
      const cmp = el('div', { class: 'cmp-text' }, content);
      moveInstrumentation(cell, cmp);
      return el('div', { class: cls('text', wrapperClass) }, cmp);
    },

    image() {
      const source = f.imageSource();
      if (!source) return null;
      const alt = f.value('imageAlt');
      const title = f.value('imageTitle');
      const popup = f.flag('imageDisplayPopupTitle');
      const link = safeUrl(f.href('imageLink'));
      const target = f.flag('imageLinkNewTab') ? '_blank' : null;
      const img = el('img', {
        class: 'cmp-image__image',
        src: source.src,
        srcset: source.srcset,
        width: source.width,
        height: source.height,
        loading: 'lazy',
        title: popup ? title : null,
      });
      img.setAttribute('alt', alt);
      if (!alt) img.setAttribute('role', 'presentation');
      img.setAttribute('itemprop', 'contentUrl');
      moveInstrumentation(source.img || f.cells.image, img);
      return el(
        'div',
        { class: 'image' },
        el(
          'div',
          { class: 'cmp-image', itemscope: true, itemtype: 'http://schema.org/ImageObject' },
          link ? el('a', {
            class: 'cmp-image__link', href: link, target, rel: target ? 'noopener noreferrer' : null,
          }, img) : img,
          title && !popup ? el('span', { class: 'cmp-image__title', itemprop: 'caption' }, title) : null,
          title && popup ? el('meta', { itemprop: 'caption', content: title }) : null,
        ),
      );
    },

    /** selectors: '' renders the .btn button; 'text-link[.black][.small][.second]' a.text-link */
    link(name, { wrapperClass = '', selectors = '' } = {}) {
      const label = f.value(`${name}Text`);
      if (!label) return null;
      const url = safeUrl(f.href(name));
      const target = f.flag(`${name}NewTab`) ? '_blank' : null;
      const rel = target ? 'noopener noreferrer' : null;
      const ariaLabel = f.value(`${name}AccessibilityLabel`);
      let node;
      if (selectors.startsWith('text-link')) {
        const mods = selectors.split('.');
        node = el(
          'a',
          {
            href: url || '#',
            target,
            rel,
            'aria-label': ariaLabel,
            class: cls('text-link', mods.includes('black') ? 'text-link--black' : '', mods.includes('second') ? 'link--margin-left' : ''),
          },
          `${label} `,
          el('span', { 'aria-hidden': 'true', class: `icon icon--arrow-right-2-16 ${mods.includes('small') ? 'icon--16' : 'icon--24'}` }),
        );
      } else {
        const icon = f.value(`${name}Icon`);
        const content = [
          el('span', { class: 'cmp-button__text' }, label),
          icon ? el('span', { class: `cmp-button__icon cmp-button__icon--${icon}`, 'aria-hidden': 'true' }) : null,
        ];
        node = url
          ? el('a', {
            class: 'cmp-button btn', href: url, target, rel, 'aria-label': ariaLabel,
          }, content)
          : el('button', { type: 'button', class: 'cmp-button btn', 'aria-label': ariaLabel }, content);
      }
      if (f.cells[`${name}Text`]) moveInstrumentation(f.cells[`${name}Text`], node);
      return el('div', { class: cls('button', wrapperClass) }, node);
    },
  };
}

/** Same values the ContentBlock Sling model hands to the HTL. */
function createModel(f, videoRows) {
  const type = oneOf(f.value('type'), TYPES, 'image');
  const defaults = DEFAULTS[type];
  const color = oneOf(f.value('color'), defaults.colors, defaults.color);
  const m = {
    type,
    color,
    id: f.value('id'),
    hasTitle: f.value('title') !== '',
    standfirst: f.hasRich('standfirst'),
    text: f.hasRich('text'),
    description: f.hasRich('description'),
    image: !!f.imageSource(),
    primaryLink: f.value('primaryLinkText') !== '',
    secondaryLink: f.value('secondaryLinkText') !== '',
    linkAsButton: f.value('linkStyle') === 'button',
    watermark: f.value('watermark'),
    imageSide: null,
    textColumnClass: 'col-12 d-flex flex-column',
    imageColumnClass: null,
  };

  blockCount += 1;
  const idPrefix = `content-block-${blockCount}-video`;
  m.videos = [];
  videoRows.forEach((row) => {
    const [urlCell, labelCell] = row.children;
    const embed = embedUrl(urlCell.querySelector('a[href]')?.getAttribute('href') || urlCell.textContent);
    if (embed) {
      const id = `${idPrefix}${m.videos.length + 1}`;
      m.videos.push({
        embedUrl: embed,
        label: labelCell?.textContent.trim() || '',
        id,
        panelId: `${id}-tab`,
        first: m.videos.length === 0,
        row,
      });
    }
  });
  m.gallery = m.videos.length > 1;

  // without an image (outside the editor) the text takes the whole row
  if (type === 'image' && (m.image || IS_UE)) {
    m.imageSide = f.value('imagePosition') === 'left' ? 'left' : 'right';
    const [textCols, imageCols] = oneOf(f.value('columns'), COLUMNS, COLUMNS[0]).split('-');
    if (m.imageSide === 'right') {
      m.textColumnClass = `col-12 col-md-${textCols} d-flex flex-column mb-64 mb-sm-0`;
      m.imageColumnClass = `col-12 col-md-${imageCols}`;
    } else {
      m.imageColumnClass = `col-12 col-md-${imageCols} mb-40 mb-sm-0`;
      m.textColumnClass = `col-12 col-md-${textCols} d-flex flex-column`;
    }
  }
  m.imageLeft = m.imageSide === 'left';
  m.imageRight = m.imageSide === 'right';
  m.linkInFooter = m.imageLeft || m.linkAsButton;
  m.titleClass = type === 'image' && m.standfirst && m.imageSide ? 'mb-40' : defaults.titleClass;
  m.squareClass = `main-banner-landing__square main-banner-landing__square--${color}`;

  let typeClass;
  switch (type) {
    case 'centered':
      typeClass = 'content-block content-block--corporate row';
      break;
    case 'video':
      typeClass = cls(`video video_${color}`, f.flag('watermarkSmall') ? 'video--background-small' : '');
      break;
    case 'video-dist':
      typeClass = `banner-dist video-dist video--${color} row d-flex flex-row`;
      break;
    case 'form':
      typeClass = cls(
        'main-banner-landing',
        m.description ? `main-banner-landing--${color}` : 'main-banner-landing--single',
        'row justify-content-between',
      );
      break;
    default: {
      const side = m.imageSide || 'right';
      const variant = IMAGE_VARIANTS[f.value('imageVariant')] || '';
      typeClass = cls(
        'content-block',
        color ? `content-block_${color}` : '',
        variant.replace('{side}', side),
        'row justify-content-between',
        m.imageSide ? IMAGE_STYLES[f.value('imageStyle')] || '' : '',
      );
    }
  }
  m.rootClass = cls(typeClass, defaults.spacing);
  m.empty = !m.hasTitle && !m.standfirst && !m.text && !m.description && !m.image
    && !m.videos.length && !m.primaryLink && !m.secondaryLink;
  return m;
}

/** variants/player.html */
function player(video) {
  return el(
    'div',
    { class: 'video__container__player' },
    el(
      'div',
      { class: 'video__container__player__image-wrapper w-100 h-100' },
      el('iframe', {
        src: video.embedUrl,
        title: video.label || 'YouTube video player',
        frameborder: '0',
        allowfullscreen: true,
        allow: 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture',
        loading: 'lazy',
      }),
    ),
  );
}

/** variants/image.html */
function renderImage(m, a) {
  const imageColumn = () => el(
    'div',
    { class: m.imageColumnClass },
    el('div', { class: 'content-block__image' }, el('div', { class: 'content-block__image-base' }), a.image()),
  );
  let footer = null;
  if (m.primaryLink || IS_UE) {
    const link = m.linkAsButton
      ? a.link('primaryLink', { wrapperClass: 'button--primary' })
      : a.link('primaryLink', { selectors: 'text-link' });
    footer = m.linkInFooter ? el('div', { class: 'content-block__footer' }, link) : link;
  }
  return el(
    'div',
    { id: m.id, class: m.rootClass },
    m.imageLeft ? imageColumn() : null,
    el(
      'div',
      { class: m.textColumnClass },
      el(
        'div',
        { class: 'content-block__text' },
        a.title(m.titleClass),
        a.text('standfirst', 'h5 mb-16', true),
        a.text('text', '', true),
        footer,
      ),
    ),
    m.imageRight ? imageColumn() : null,
  );
}

/** variants/centered.html */
function renderCentered(m, a) {
  return el(
    'div',
    { id: m.id, class: m.rootClass },
    el(
      'div',
      { class: 'col-12 col-md-6 col-xl-5 d-flex flex-column justify-content-start mb-64 mb-sm-0 order-2 order-sm-1' },
      el(
        'div',
        { class: 'content-block__text' },
        a.title(m.titleClass),
        a.text('standfirst', 'content-block__paragraph mb-24', true),
        a.text('text', 'content-block__list', true),
        a.link('primaryLink', { wrapperClass: 'content-block__actions button--primary' }),
      ),
    ),
    m.image || IS_UE ? el(
      'div',
      { class: 'col-12 col-md-6 offset-xl-1 order-1 order-sm-2 mb-64 mb-sm-0' },
      el(
        'div',
        { class: 'carusel-corporate__container' },
        el('div', { class: 'carusel-corporate__slide fade' }, a.image()),
      ),
    ) : null,
  );
}

/** variants/video.html: one video, or Vídeo galería (tab panels + list of links). */
function renderVideo(m, a) {
  const { gallery } = m;
  const panels = m.videos.map((video) => {
    const panel = el('div', {
      class: 'video__container',
      id: gallery ? video.panelId : null,
      role: gallery ? 'tabpanel' : null,
      'aria-labelledby': gallery ? video.id : null,
      tabindex: gallery ? '0' : null,
      hidden: gallery && !video.first,
      'data-content-block-panel': gallery,
    }, player(video));
    moveInstrumentation(video.row, panel);
    return panel;
  });
  const tabs = m.videos.map((video) => el(
    'a',
    {
      href: `#${video.panelId}`,
      id: video.id,
      role: 'tab',
      'aria-controls': video.panelId,
      'aria-selected': video.first ? 'true' : 'false',
      class: `content-box-video content-box-video__content${video.first ? ' active' : ''}`,
      'data-content-block-tab': true,
    },
    el('span', { 'aria-hidden': 'true', class: 'icon icon--play-16 icon--24' }),
    video.label || video.id,
  ));
  const text = [
    a.title(m.titleClass),
    m.primaryLink || m.secondaryLink || IS_UE ? el(
      'div',
      {},
      a.link('primaryLink', { selectors: 'text-link.small' }),
      a.link('secondaryLink', { selectors: 'text-link.small.second' }),
    ) : null,
  ];
  return el(
    'div',
    { id: m.id, class: m.rootClass, 'data-content-block-gallery': gallery },
    m.watermark ? el('div', { class: 'video__background-text d-none d-md-block' }, m.watermark) : null,
    el(
      'div',
      { class: 'row justify-content-between' },
      m.videos.length ? el('div', { class: 'col-12 col-md-6 mb-64 mb-sm-0' }, panels) : null,
      el('div', { class: 'col-12 col-md-6 col-xxl-5 video__right-side' }, gallery ? tabs : text),
    ),
  );
}

/** variants/video-dist.html */
function renderVideoDist(m, a) {
  const both = m.primaryLink && m.secondaryLink;
  return el(
    'div',
    { id: m.id, class: m.rootClass },
    el(
      'div',
      { class: 'col-12 col-md-7 col-lg-6 col-xl-5 offset-xl-1 d-flex flex-column justify-content-between' },
      el(
        'div',
        { class: 'banner-dist__text' },
        a.title(m.titleClass),
        m.standfirst || IS_UE ? el(
          'div',
          { class: 'banner-dist__text__sub-claim h3' },
          a.text('standfirst', 'small-text', true),
        ) : null,
      ),
      m.primaryLink || m.secondaryLink || IS_UE ? el(
        'div',
        { class: `banner-dist__buttons${both ? ' banner-dist__buttons-doble' : ''}` },
        a.link('primaryLink', { wrapperClass: 'button--primary' }),
        a.link('secondaryLink', { wrapperClass: 'button--secondary' }),
      ) : null,
    ),
    el(
      'div',
      { class: 'banner-dist__right-side col-12 col-md-5 col-lg-6' },
      m.videos.length ? el('div', { class: 'video__container' }, player(m.videos[0])) : null,
    ),
  );
}

/** variants/form.html: the form column is a container with the "form" fragment. */
function renderForm(m, a, container) {
  return el(
    'div',
    { id: m.id, class: m.rootClass },
    el(
      'div',
      { class: 'col-12 col-sm-5 col-lg-8' },
      el('div', { class: 'main-banner-landing__text' }, a.title(m.titleClass), a.text('standfirst', '', true)),
      m.image || IS_UE ? el('div', { class: 'main-banner-landing__image' }, a.image()) : null,
      m.description || IS_UE ? el(
        'div',
        { class: 'd-flex align-items-end mb-24' },
        a.text('description', 'main-banner-landing__features'),
      ) : null,
      !m.description ? el('div', { class: m.squareClass }) : null,
      m.primaryLink || IS_UE ? el(
        'div',
        { class: 'main-banner-landing__button' },
        a.link('primaryLink', { selectors: 'text-link.black' }),
      ) : null,
    ),
    el(
      'div',
      { class: 'col-sm-6 col-lg-4' },
      el(
        'div',
        { class: 'content-box' },
        el('div', { class: 'content-box__content content-box--overflow' }, container),
      ),
    ),
  );
}

async function loadForm(f, target) {
  const url = safeUrl(f.href('form'));
  if (!url) return;
  const { origin, pathname } = new URL(url, window.location.href);
  if (origin !== window.location.origin) return;
  const { loadFragment } = await import('../fragment/fragment.js');
  const fragment = await loadFragment(pathname);
  const section = fragment?.querySelector(':scope .section');
  if (section) target.append(...section.childNodes);
}

/** Vídeo galería: the list switches the panel; hidden players are reloaded so they stop. */
function setupGallery(gallery) {
  const tabs = gallery.querySelectorAll('[data-content-block-tab]');
  const panels = gallery.querySelectorAll('[data-content-block-panel]');
  const select = (index) => {
    tabs.forEach((tab, i) => {
      const active = i === index;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      const panel = panels[i];
      if (!panel) return;
      if (!active && !panel.hidden) {
        const iframe = panel.querySelector('iframe');
        if (iframe) iframe.setAttribute('src', iframe.getAttribute('src'));
      }
      panel.hidden = !active;
    });
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', (event) => {
      event.preventDefault();
      select(index);
    });
  });
}

export default async function decorate(block) {
  const { cells, videoRows } = readRows(block);
  const f = createFields(cells);
  const m = createModel(f, videoRows);
  const a = createAtoms(f);

  if (m.empty && m.type !== 'form' && !IS_UE) {
    block.replaceChildren();
    return;
  }

  let root;
  let formTarget;
  switch (m.type) {
    case 'centered':
      root = renderCentered(m, a);
      break;
    case 'video':
      root = renderVideo(m, a);
      break;
    case 'video-dist':
      root = renderVideoDist(m, a);
      break;
    case 'form':
      formTarget = el('div', { class: 'cmp-container' });
      root = renderForm(m, a, el('div', { class: 'container responsivegrid' }, formTarget));
      break;
    default:
      root = renderImage(m, a);
  }

  block.replaceChildren(root);
  if (m.gallery) setupGallery(root);
  if (formTarget) await loadForm(f, formTarget);
}
