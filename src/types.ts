export type ProjectType =
	| "unity"
	| "springboot"
	| "android"
	| "nextjs"
	| "fastapi"
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
	commentStdout?: boolean;
}

export interface UserComment {
	id: string;
	user: string;
	body: string;
	createdAt: string;
	path?: string;
	line?: number;
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
	userComments?: UserComment[];
}

export interface PromptTemplate {
	generatePrompt: (context: ReviewContext) => string;
}

export interface ReviewComment {
	path: string;
	line: number;
	body: string;
}

export interface StructuredReview {
	summary: string;
	comments: ReviewComment[];
}
