import { defineArrayMember, defineField, defineType } from "sanity";
import { orderRankField, orderRankOrdering } from "@sanity/orderable-document-list";

const SERVICES = ["Branding", "Webflow", "Product Design", "Strategy", "Hosting"];

export const project = defineType({
  name: "project",
  title: "Project",
  type: "document",
  orderings: [orderRankOrdering],
  groups: [
    { name: "content", title: "Content", default: true },
    { name: "media", title: "Media" },
    { name: "meta", title: "Details" },
  ],
  fields: [
    orderRankField({ type: "project" }),
    defineField({ name: "title", type: "string", group: "content", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      type: "slug",
      group: "content",
      options: { source: "title", maxLength: 96 },
      validation: (r) => r.required(),
    }),
    defineField({ name: "client", type: "string", group: "content", validation: (r) => r.required() }),
    defineField({
      name: "summary",
      type: "text",
      rows: 3,
      group: "content",
      description: "One or two sentences. Shown on cards and as the case study intro.",
      validation: (r) => r.required().max(240),
    }),
    defineField({
      name: "statement",
      type: "string",
      group: "content",
      description: "One-line headline for the brief, e.g. “A brand that makes cybersecurity feel bulletproof.” Falls back to the summary.",
    }),
    defineField({ name: "body", type: "richText", group: "content" }),

    defineField({ name: "cover", type: "altImage", group: "media" }),
    defineField({ name: "gallery", type: "array", group: "media", of: [defineArrayMember({ type: "altImage" })] }),
    defineField({
      name: "logo",
      title: "Client logo",
      type: "altImage",
      group: "media",
      description: "SVG or transparent PNG. Shown white on the case study header and over the work grid card.",
    }),
    defineField({ name: "plate", type: "plate", group: "media" }),

    defineField({ name: "industry", type: "string", group: "meta", validation: (r) => r.required() }),
    defineField({
      name: "services",
      type: "array",
      group: "meta",
      of: [defineArrayMember({ type: "string" })],
      options: { list: SERVICES.map((s) => ({ title: s, value: s })), layout: "grid" },
    }),
    defineField({
      name: "featured",
      type: "boolean",
      group: "meta",
      initialValue: false,
      description: "Show on the home page (the first four featured projects appear).",
    }),
    defineField({ name: "url", title: "Live site", type: "url", group: "meta" }),
    defineField({
      name: "partnerSince",
      title: "Client since",
      type: "number",
      group: "meta",
      description: "Year the relationship started. Adds one square per year to the index.",
      validation: (r) => r.integer().min(2011).max(2100),
    }),
    defineField({
      name: "partnerUntil",
      title: "Client until",
      type: "number",
      group: "meta",
      description: "Leave empty if they're still a client.",
      validation: (r) => r.integer().min(2011).max(2100),
    }),
    defineField({
      name: "launched",
      title: "Year",
      type: "number",
      group: "meta",
      description: "Year the work shipped. Drives the year column and the Most Recent sort.",
    }),
    defineField({ name: "facts", type: "array", group: "meta", of: [defineArrayMember({ type: "fact" })] }),
  ],
  preview: {
    select: { title: "title", subtitle: "client", media: "cover" },
  },
});
