import { CodeBlockWriter, MethodDeclarationStructure, OptionalKind, ParameterDeclarationStructure, Scope } from 'ts-morph';

import { MethodKind } from '../../models/kinds/MethodKind';
import { MethodOperation } from '../../models/kinds/MethodOperation';
import { ParameterPlace } from '../../models/kinds/ParameterPlace';
import { PropertyKind } from '../../models/kinds/PropertyKind';
import { IBodyParameter } from '../../models/method-parameter/IBodyParameter';
import { IMethodModel } from '../../models/method-parameter/IMethodModel';
import { IPathParameter } from '../../models/method-parameter/IPathParameter';
import { IQueryParameter } from '../../models/method-parameter/IQueryParameter';
import { IReturnType } from '../../models/method-parameter/IReturnType';
import { UriBuilder } from '../../services/UriBuilder';
import { MAPPERS_NAMESPACE, MODELS_NAMESPACE, UNDEFINED_STRING } from '../utils/consts';
import { TypeSerializer } from '../utils/TypeSerializer';

export const HTTP_REQUEST_OPTIONS = 'IAngularHttpRequestOptions';

interface IParameterType {
    type: string;
    isModel: boolean;
    isCollection?: boolean;
    isOptional?: boolean;
}

export class AngularServicesMethodGenerator {
    constructor(private uriBuilder: UriBuilder) {}

    public getMethodsCodeStructures(methodModels: IMethodModel[]): OptionalKind<MethodDeclarationStructure>[] {
        return methodModels.map(
            (methodModel): OptionalKind<MethodDeclarationStructure> => ({
                scope: Scope.Public,
                name: methodModel.name,
                parameters: methodModel.parameters.map((p) => this.getParameterStatement(p)),
                returnType: this.getMethodReturnType(methodModel),
                statements: (writer) => {
                    if (methodModel.kind === MethodKind.Download) {
                        this.createDownloadMethod(writer, methodModel);
                    } else {
                        this.createMethod(writer, methodModel);
                    }
                }
            })
        );
    }

    private getParameterStatement(
        parameter: IQueryParameter | IPathParameter | IBodyParameter
    ): OptionalKind<ParameterDeclarationStructure> {
        const statement: OptionalKind<ParameterDeclarationStructure> = {
            name: parameter.name,
            type: undefined,
            initializer: undefined
        };

        switch (parameter.place) {
            case ParameterPlace.Path:
                statement.type = this.getFullTypeName({
                    type: parameter.dtoType,
                    isModel: parameter.isModel,
                    isOptional: false
                });
                break;
            case ParameterPlace.Query:
                statement.type = this.getFullTypeName({
                    type: parameter.dtoType,
                    isModel: parameter.isModel,
                    isOptional: parameter.optional
                });
                statement.hasQuestionToken = parameter.optional;
                break;
            case ParameterPlace.Body:
                statement.type = this.getFullTypeName({
                    type: parameter.dtoType,
                    isCollection: parameter.isCollection,
                    isModel: parameter.isModel,
                    isOptional: parameter.optional
                });
                statement.hasQuestionToken = parameter.optional;
                break;
        }

        return statement;
    }

    private getReturnTypeName(returnType: IReturnType | undefined, targetType: string | undefined): string {
        if (!returnType || !targetType) {
            return 'void';
        }

        return this.getFullTypeName({
            type: targetType,
            isCollection: returnType.isCollection,
            isModel: returnType.isModel,
            isOptional: returnType.isModel && !returnType.isCollection
        });
    }

    private getFullTypeName({ type, isCollection, isModel, isOptional }: IParameterType): string {
        const typeName = `${isModel ? `${MODELS_NAMESPACE}.` : ''}${type}`;

        return new TypeSerializer({
            type: typeName,
            isCollection,
            isOptional
        }).toString();
    }

    private needPipe(returnType: IReturnType | undefined): returnType is IReturnType {
        if (!returnType) {
            return false;
        }

        return [PropertyKind.Object, PropertyKind.Identity, PropertyKind.Guid, PropertyKind.Date].includes(returnType.type.kind);
    }
    private createPipe(returnType: IReturnType): string {
        if (returnType.type.kind === PropertyKind.Guid) {
            return `${MAPPERS_NAMESPACE}.mapGuid()`;
        }

        if (returnType.type.kind === PropertyKind.Date) {
            return `${MAPPERS_NAMESPACE}.mapDate()`;
        }

        const type = `${MODELS_NAMESPACE}.${returnType.type.type}`;
        if (returnType.isCollection) {
            if (returnType.type.kind === PropertyKind.Identity) {
                return `${MAPPERS_NAMESPACE}.mapIdentityCollection(${type})`;
            }

            return `${MAPPERS_NAMESPACE}.mapCollection(${type})`;
        }

        if (returnType.type.kind === PropertyKind.Identity) {
            return `${MAPPERS_NAMESPACE}.mapIdentitySingle(${type})`;
        }

        return `${MAPPERS_NAMESPACE}.mapSingle(${type})`;
    }
    private getMethodReturnType(x: IMethodModel): string {
        return x.kind === MethodKind.Download
            ? `Promise<${x.returnType?.type.type}>`
            : `Observable<${this.getReturnTypeName(x.returnType, x.returnType?.type.type)}>`;
    }
    private createDownloadMethod(writer: CodeBlockWriter, model: IMethodModel): void {
        const bodyParameters = model.parameters.filter((z) => z.name !== 'saveAs' && z.place === ParameterPlace.Body);
        const dataParameter = bodyParameters.find((z) => z.name !== 'options');
        const optionsParameter = bodyParameters.find((z) => z.name === 'options');

        if (!model.parameters.find((z) => z.name === 'saveAs')) {
            throw new Error(`Cannot find 'saveAs' parameter for method ${model.name}`);
        }

        writer.writeLine('return this.downloadFile(');
        writer.withIndentationLevel(3, () => writer.writeLine(`${this.uriBuilder.buildUri(model)},`));
        writer.withIndentationLevel(3, () => writer.writeLine(`'${MethodOperation[model.operation].toLowerCase()}',`));
        writer.withIndentationLevel(3, () => writer.writeLine(`${dataParameter?.name ?? UNDEFINED_STRING},`));
        writer.withIndentationLevel(3, () => writer.writeLine('saveAs,'));
        writer.withIndentationLevel(3, () => writer.writeLine(`${optionsParameter?.name ?? UNDEFINED_STRING}`));
        writer.writeLine(');');
    }

    private createMethod(writer: CodeBlockWriter, model: IMethodModel): void {
        writer.writeLine(
            `return this.${MethodOperation[model.operation].toLowerCase()}<${this.getReturnTypeName(
                model.returnType,
                model.returnType?.type.dtoType
            )}>(`
        );
        writer.withIndentationLevel(3, () => writer.writeLine(`${this.uriBuilder.buildUri(model)},`));
        model.parameters
            .filter((z) => z.place === ParameterPlace.Body)
            .forEach((z) => {
                writer.withIndentationLevel(3, () => writer.writeLine(`${z.name},`));
            });

        if (this.needPipe(model.returnType)) {
            writer.writeLine(`).pipe(${this.createPipe(model.returnType)});`);
            return;
        }

        writer.writeLine(');');
    }
}
