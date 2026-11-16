import { defineConfig } from "sanity";
import { structureTool, type StructureBuilder } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { orderableDocumentListDeskItem } from "@sanity/orderable-document-list";
import { schemaTypes } from "./schemaTypes";

const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? "9xn8x41p";
const dataset = process.env.SANITY_STUDIO_DATASET ?? "production";

/** A newest-first list of form submissions, optionally narrowed by a GROQ condition. */
const submissions = (S: StructureBuilder, title: string, where: string | null) =>
  S.listItem()
    .title(title)
    .id(`submissions-${title.toLowerCase()}`)
    .child(
      S.documentList()
        .title(title === "All" ? "All submissions" : `${title} submissions`)
        .schemaType("formSubmission")
        .filter(`_type == "formSubmission"${where ? ` && ${where}` : ""}`)
        .defaultOrdering([{ field: "submittedAt", direction: "desc" }]),
    );

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
            S.divider(),
            S.listItem()
              .title("Form submissions")
              .id("formSubmissions")
              .child(
                S.list()
                  .title("Form submissions")
                  .items([
                    submissions(S, "New", 'status == "new"'),
                    submissions(S, "Replied", 'status == "replied"'),
                    submissions(S, "Archived", 'status == "archived"'),
                    S.divider(),
                    submissions(S, "All", null),
                  ]),
              ),
          ]),
    }),
    visionTool(),
  ],
  schema: {
    types: schemaTypes,
    // Site settings is a singleton and submissions only come from the forms service: hide both from "Create new"
    templates: (templates) => templates.filter(({ schemaType }) => !["siteSettings", "formSubmission"].includes(schemaType)),
  },
  document: {
    actions: (actions, { schemaType }) =>
      schemaType === "siteSettings"
        ? actions.filter(({ action }) => action && ["publish", "discardChanges", "restore"].includes(action))
        : schemaType === "formSubmission"
          ? actions.filter(({ action }) => action !== "duplicate")
          : actions,
  },
});
