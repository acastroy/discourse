"use strict";

const Plugin = require("broccoli-plugin");
const bent = require("bent");
const getJSON = bent("json");
const { encode } = require("html-entities");

let _bootstrap;
let _proxy;

class DiscourseBootstrap extends Plugin {
  async build() {
    _bootstrap = (await getJSON(`${_proxy}/bootstrap.json`)).bootstrap;
  }
}

function headTag(buffer, bootstrap) {
  let classList = "";
  if (bootstrap.html_classes) {
    classList = ` class="${bootstrap.html_classes}"`;
  }
  buffer.push(`<head lang="${bootstrap.html_lang}"${classList}>`);
}

function head(buffer, bootstrap) {
  if (bootstrap.csrf_token) {
    buffer.push(`<meta name="csrf-param" buffer="authenticity_token">`);
    buffer.push(`<meta name="csrf-token" buffer="${bootstrap.csrf_token}">`);
  }
  if (bootstrap.theme_ids) {
    buffer.push(
      `<meta name="discourse_theme_ids" buffer="${bootstrap.theme_ids}">`
    );
  }

  let setupData = "";
  Object.keys(bootstrap.setup_data).forEach((sd) => {
    let val = bootstrap.setup_data[sd];
    if (val) {
      if (Array.isArray(val)) {
        val = JSON.stringify(val);
      } else {
        val = val.toString();
      }
      setupData += ` data-${sd.replace(/\_/g, "-")}="${encode(val)}"`;
    }
  });
  buffer.push(`<meta id="data-discourse-setup"${setupData} />`);

  (bootstrap.stylesheets || []).forEach((s) => {
    let attrs = [];
    if (s.media) {
      attrs.push(`media="${s.media}"`);
    }
    if (s.target) {
      attrs.push(`data-target="${s.target}"`);
    }
    if (s.theme_id) {
      attrs.push(`data-theme-id="${s.theme_id}"`);
    }
    let link = `<link rel="stylesheet" type="text/css" href="${
      s.href
    }" ${attrs.join(" ")}></script>\n`;
    buffer.push(link);
  });

  bootstrap.plugin_js.forEach((src) =>
    buffer.push(`<script src="${src}"></script>`)
  );

  buffer.push(bootstrap.theme_html.translations);
  buffer.push(bootstrap.theme_html.js);
  buffer.push(bootstrap.theme_html.head_tag);
  buffer.push(bootstrap.html.before_head_close);
}

function beforeScriptLoad(buffer, bootstrap) {
  buffer.push(bootstrap.html.before_script_load);
  buffer.push(`<script src="${bootstrap.locale_script}"></script>`);
  (bootstrap.extra_locales || []).forEach((l) =>
    buffer.push(`<script src="${l}"></script>`)
  );
}

function body(buffer, bootstrap) {
  buffer.push(bootstrap.theme_html.header);
  buffer.push(bootstrap.html.header);
}

function bodyFooter(buffer, bootstrap) {
  buffer.push(bootstrap.theme_html.body_tag);
  buffer.push(bootstrap.html.before_body_close);
}

function preloaded(buffer, bootstrap) {
  buffer.push(
    `<div class="hidden" id="data-preloaded" data-preloaded="${encode(
      JSON.stringify(bootstrap.preloaded)
    )}"></div>`
  );
}

function output(builder, bootstrap) {
  let buffer = [];
  builder(buffer, bootstrap);
  return buffer.filter((b) => b && b.length > 0).join("\n");
}

module.exports = {
  name: require("./package").name,

  isDevelopingAddon() {
    return true;
  },

  contentFor(type) {
    if (!_bootstrap) {
      return;
    }

    switch (type) {
      case "head-tag":
        return output(headTag, _bootstrap);
      case "before-script-load":
        return output(beforeScriptLoad, _bootstrap);
      case "head":
        return output(head, _bootstrap);
      case "body":
        return output(body, _bootstrap);
      case "body-footer":
        return output(bodyFooter, _bootstrap);
      case "preloaded":
        return output(preloaded, _bootstrap);
    }
  },

  serverMiddleware(config) {
    _proxy = config.options.proxy;
  },

  treeForAddon() {
    return new DiscourseBootstrap([]);
  },
};
