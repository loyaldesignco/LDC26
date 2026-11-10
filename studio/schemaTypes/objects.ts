import { defineArrayMember, defineField, defineType } from "sanity";

/** Image with required alt text, used everywhere an image appears. */
export const altImage = defineType({
  name: "altImage",
  title: "Image",
  type: "image",
  options: { hotspot: true },
  fields: [
    defineField({
      name: "alt",
      title: "Alt text",
      type: "string",
      description: "Describe what the image shows for people using screen readers.",
      validation: (r) => r.required(),
    }),
    defineField({ name: "caption", type: "string" }),
  ],
});

/** Generated cover art used when no image is uploaded. */
export const plate = defineType({
  name: "plate",
  title: "Generated cover",
  type: "object",
  description: "Shown when a project or post has no cover image.",
  fields: [
    defineField({ name: "background", type: "string", initialValue: "#000000", description: "Hex color" }),
    defineField({ name: "foreground", type: "string", initialValue: "#f6f4e7", description: "Hex color" }),
    defineField({
      name: "motif",
      type: "string",
      initialValue: "grid",
      options: { list: ["grid", "orbit", "stripes", "stack", "type"], layout: "radio", direction: "horizontal" },
    }),
    defineField({ name: "mark", type: "string", description: "Short text for the 'type' motif, e.g. initials." }),
  ],
});

export const fact = defineType({
  name: "fact",
  type: "object",
  fields: [
    defineField({ name: "label", type: "string", validation: (r) => r.required() }),
    defineField({ name: "value", type: "string", validation: (r) => r.required() }),
  ],
  preview: { select: { title: "label", subtitle: "value" } },
});

export const processStep = defineType({
  name: "processStep",
  title: "Process step",
  type: "object",
  fields: [
    defineField({ name: "title", type: "string", validation: (r) => r.required() }),
    defineField({ name: "body", type: "text", rows: 3, validation: (r) => r.required() }),
  ],
});

export const richText = defineType({
  name: "richText",
  title: "Body",
  type: "array",
  of: [
    defineArrayMember({
      type: "block",
      styles: [
        { title: "Normal", value: "normal" },
        { title: "Heading", value: "h2" },
        { title: "Subheading", value: "h3" },
        { title: "Quote", value: "blockquote" },
      ],
    }),
    defineArrayMember({ type: "altImage" }),
  ],
});
