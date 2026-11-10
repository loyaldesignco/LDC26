import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { orderableDocumentListDeskItem } from "@sanity/orderable-document-list";
import { schemaTypes } from "./schemaTypes";

const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? "";
const dataset = process.env.SANITY_STUDIO_DATASET ?? "production";

export default defineConfig({
  name: "loyal-design",
  title: "Loyal Design Co",
  projectId,
  dataset,
  plugins: [
    structureTool({
      structure: (S, context) =>
        S.list()
          .title("Content")
          .items([
            S.listItem()
              .title("Site settings")
              .id("siteSettings")
              .child(S.document().schemaType("siteSettings").documentId("siteSettings")),
            S.divider(),
            orderableDocumentListDeskItem({ type: "project", title: "Work", S, context }),
            orderableDocumentListDeskItem({ type: "service", title: "Services", S, context }),
            S.documentTypeListItem("post").title("Journal"),
            S.documentTypeListItem("testimonial").title("Testimonials"),
          ]),
    }),
    visionTool(),
  ],
  schema: {
    types: schemaTypes,
    // Site settings is a singleton: hide it from "Create new"
    templates: (templates) => templates.filter(({ schemaType }) => schemaType !== "siteSettings"),
  },
  document: {
    actions: (actions, { schemaType }) =>
      schemaType === "siteSettings"
        ? actions.filter(({ action }) => action && ["publish", "discardChanges", "restore"].includes(action))
        : actions,
  },
});
