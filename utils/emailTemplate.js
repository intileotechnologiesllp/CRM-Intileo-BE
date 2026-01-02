exports.jsonToHtml = (node) => {
  //   console.log("step1")
  if (!node || typeof node !== "object") return "";

  //   console.log("step2")
  const {
    type,
    style = {},
    data = {},
    content = "",
    css = "",
    children = [],
  } = node;

  // Convert style object to inline CSS
  const styleString = Object.entries(style)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");

  // Convert data object to HTML attributes
  const dataAttributes = Object.entries(data)
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");

  // Build opening tag
  const openTag = `<${type}
    ${css ? `class="${css}"` : ""}
    ${styleString ? `style="${styleString}"` : ""}
    ${dataAttributes}
  >`.replace(/\s+/g, " ");

  // Render children recursively
  const childrenHtml = children.map(jsonToHtml).join("");

  // Self-closing tags
  const selfClosingTags = ["img", "input", "br", "hr", "meta", "link"];

  if (selfClosingTags.includes(type)) {
    return `<${type}
      ${css ? `class="${css}"` : ""}
      ${styleString ? `style="${styleString}"` : ""}
      ${dataAttributes}
    />`.replace(/\s+/g, " ");
  }

  // Normal element
  return `${openTag}${content}${childrenHtml}</${type}>`;
};
