import { defineArrayMember, defineField, defineType } from "sanity";
import { orderRankField, orderRankOrdering } from "@sanity/orderable-document-list";

export const service = defineType({
  name: "service",
  type: "document",
  orderings: [orderRankOrdering],
  fields: [
    orderRankField({ type: "service" }),
    defineField({ name: "title", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      type: "slug",
      options: { source: "title" },
      description: "Set this to give the service its own page. Leave empty and the row links to the work filter instead.",
    }),
    defineField({
      name: "summary",
      type: "string",
      description: "Short list for the home row, separated with ·",
      validation: (r) => r.required(),
    }),
    defineField({ name: "deliverables", type: "array", of: [defineArrayMember({ type: "string" })] }),
    defineField({
      name: "workFilter",
      type: "string",
      options: { list: ["Branding", "Webflow", "Product Design", "Strategy"] },
    }),
    defineField({ name: "image", type: "altImage" }),
    defineField({ name: "meta", type: "string", fieldset: "page" }),
    defineField({ name: "statement", type: "string", fieldset: "page" }),
    defineField({ name: "intro", type: "array", of: [defineArrayMember({ type: "text", rows: 3 })], fieldset: "page" }),
    defineField({
      name: "capabilities",
      type: "array",
      fieldset: "page",
      of: [defineArrayMember({ type: "object", fields: [defineField({ name: "name", type: "string" }), defineField({ name: "desc", type: "text", rows: 2 })] })],
    }),
    defineField({ name: "processTitle", type: "string", fieldset: "page" }),
    defineField({ name: "stats", type: "array", of: [defineArrayMember({ type: "string" })], fieldset: "page" }),
    defineField({
      name: "steps",
      type: "array",
      fieldset: "page",
      of: [
        defineArrayMember({
          type: "object",
          fields: [defineField({ name: "name", type: "string" }), defineField({ name: "dur", title: "Duration", type: "string" }), defineField({ name: "desc", type: "text", rows: 2 })],
        }),
      ],
    }),
    defineField({
      name: "faq",
      title: "FAQ",
      type: "array",
      fieldset: "page",
      of: [defineArrayMember({ type: "object", fields: [defineField({ name: "q", title: "Question", type: "string" }), defineField({ name: "a", title: "Answer", type: "text", rows: 3 })] })],
    }),
    defineField({
      name: "stack",
      type: "array",
      fieldset: "page",
      of: [defineArrayMember({ type: "object", fields: [defineField({ name: "name", type: "string" }), defineField({ name: "role", type: "string" })] })],
    }),
  ],
  fieldsets: [{ name: "page", title: "Service page", options: { collapsible: true, collapsed: true } }],
});

export const post = defineType({
  name: "post",
  title: "Journal post",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", validation: (r) => r.required() }),
    defineField({ name: "slug", type: "slug", options: { source: "title" }, validation: (r) => r.required() }),
    defineField({ name: "publishedAt", type: "date", validation: (r) => r.required() }),
    defineField({
      name: "category",
      type: "string",
      options: { list: ["Webflow", "Branding", "Search", "Studio"] },
      validation: (r) => r.required(),
    }),
    defineField({ name: "excerpt", type: "text", rows: 3, validation: (r) => r.required().max(240) }),
    defineField({ name: "cover", type: "altImage" }),
    defineField({ name: "plate", type: "plate" }),
    defineField({ name: "body", type: "richText" }),
  ],
  orderings: [{ title: "Newest", name: "newest", by: [{ field: "publishedAt", direction: "desc" }] }],
  preview: { select: { title: "title", subtitle: "publishedAt", media: "cover" } },
});

export const testimonial = defineType({
  name: "testimonial",
  type: "document",
  description: "Real client words only. The home page shows the newest one.",
  fields: [
    defineField({ name: "quote", type: "text", rows: 4, validation: (r) => r.required() }),
    defineField({ name: "name", type: "string", validation: (r) => r.required() }),
    defineField({ name: "role", type: "string" }),
    defineField({ name: "company", type: "string" }),
  ],
  preview: { select: { title: "name", subtitle: "company" } },
});

export const siteSettings = defineType({
  name: "siteSettings",
  title: "Site settings",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", initialValue: "Loyal Design Co", validation: (r) => r.required() }),
    defineField({ name: "description", type: "text", rows: 3, description: "Default meta description." }),
    defineField({ name: "email", type: "string", validation: (r) => r.required().email() }),
    defineField({ name: "location", type: "string" }),
    defineField({ name: "timezone", type: "string", initialValue: "America/New_York" }),
    defineField({ name: "coordinates", type: "string" }),
    defineField({
      name: "availability",
      type: "object",
      fields: [
        defineField({
          name: "status",
          type: "string",
          options: { list: ["open", "limited", "booked"], layout: "radio", direction: "horizontal" },
          initialValue: "open",
        }),
        defineField({ name: "note", type: "string", initialValue: "Booking new projects now" }),
      ],
    }),
    defineField({
      name: "socials",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({ name: "label", type: "string" }),
            defineField({ name: "url", type: "url" }),
          ],
        }),
      ],
    }),
    defineField({ name: "credentials", type: "array", of: [defineArrayMember({ type: "string" })] }),
    defineField({ name: "process", type: "array", of: [defineArrayMember({ type: "processStep" })] }),
    defineField({
      name: "sameAs",
      title: "Other profiles (SEO)",
      type: "array",
      of: [defineArrayMember({ type: "url" })],
      description: "Profiles that identify the studio to search engines (Clutch, Webflow, Facebook, X). Not shown on the site; the socials above are included automatically.",
    }),
    defineField({
      name: "heroSlides",
      title: "Home hero slides",
      type: "array",
      description: "Two or more cross-fade with a lens transition every 25 seconds.",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({ name: "image", type: "altImage", validation: (r) => r.required() }),
            defineField({ name: "label", type: "string", description: "e.g. Leandro Lo — Kingz" }),
            defineField({ name: "href", type: "string" }),
            defineField({ name: "logo", type: "altImage" }),
          ],
          preview: { select: { title: "label", media: "image" } },
        }),
      ],
    }),
    defineField({ name: "homePanels", title: "Home work panels", type: "array", of: [defineArrayMember({ type: "altImage" })], validation: (r) => r.max(3) }),
    defineField({ name: "processImage", title: "How we work image", type: "altImage" }),
    defineField({ name: "portrait", title: "About portrait", type: "altImage" }),
    defineField({
      name: "clients",
      title: "Client marquee",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({ name: "name", type: "string", validation: (r) => r.required() }),
            defineField({ name: "logo", type: "image", description: "SVG or transparent PNG", validation: (r) => r.required() }),
            defineField({ name: "scale", type: "number", initialValue: 1, validation: (r) => r.min(0.6).max(1.5) }),
          ],
          preview: { select: { title: "name", media: "logo" } },
        }),
      ],
    }),
  ],
  preview: { prepare: () => ({ title: "Site settings" }) },
});
