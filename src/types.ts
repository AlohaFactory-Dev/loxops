export type ProjectType =
	| "unity"
	| "springboot"
	| "android"
	| "nextjs"
	| "auto";

export interface FileChange {
	filename: string;
	status: "added" | "modified" | "removed" | "renamed";
	patch?: string;
	fullContent?: string;
	previousContent?: string;
}

export interface RelatedFiles {
	[changedFile: string]: string[];
}

export interface ReviewOptions {
	projectType: ProjectType;
	fileExtensions: string[];
	excludePatterns: string[];
	findRelatedFiles: boolean;
	maxFiles: number;
	model: string;
	useRepomix: boolean;
}

export interface ReviewContext {
	pullRequestNumber: number;
	pullRequestTitle: string;
	pullRequestBody: string | null;
	repositoryName: string;
	repositoryOwner: string;
	branch: string;
	baseRef: string;
	files: FileChange[];
	relatedFiles: RelatedFiles;
}

export interface PromptTemplate {
	generatePrompt: (context: ReviewContext) => string;
}
