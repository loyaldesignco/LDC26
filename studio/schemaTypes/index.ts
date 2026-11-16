import { altImage, fact, plate, processStep, richText } from "./objects";
import { project } from "./project";
import { post, service, siteSettings, testimonial } from "./documents";
import { formSubmission } from "./formSubmission";

export const schemaTypes = [
  // objects
  altImage,
  plate,
  fact,
  processStep,
  richText,
  // documents
  siteSettings,
  project,
  service,
  post,
  testimonial,
  formSubmission,
];
