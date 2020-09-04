import {AnyTypeDescriptorProto} from "./descriptor-info";
import {StringFormat} from "./string-format";
import {GeneratedFile} from "./generated-file";


/**
 * A table for unique symbols (for any DescriptorProto, EnumDescriptorProto
 * or ServiceDescriptorProto) in files (GeneratedFile).
 */
export class SymbolTable {


    private readonly entries: SymbolTableEntry[] = [];
    private readonly clashResolveMaxTries = 100;
    private readonly clashResolver: ClashResolver;


    constructor(clashResolver?: ClashResolver) {
        this.clashResolver = clashResolver ?? SymbolTable.defaultClashResolver;
    }


    /**
     * Register a symbol in the given file for the given descriptor.
     *
     * If the name is already taken in the file, an alternative name
     * is automatically generated by appending '$' and a running
     * number to the requested name. You can change the behaviour by
     * providing your own `clashResolver`.
     *
     * Only one symbol per kind can be registered for a descriptor.
     *
     * If you want to generate an interface *and* a class for a
     * message, use a different `kind` for each.
     *
     * Returns the actual name registered.
     */
    register(requestedName: string, descriptor: AnyTypeDescriptorProto, file: GeneratedFile, kind = 'default'): string {

        // Only one symbol per kind can be registered for a descriptor.
        if (this.has(descriptor, kind)) {
            let {file, name} = this.get(descriptor, kind);
            let msg = `Cannot register name "${requestedName}" of kind "${kind}" for ${StringFormat.formatName(descriptor)}. `
                + `The descriptor is already registered in file "${file.getFilename()}" with name "${name}". `
                + `Use a different 'kind' to register multiple symbols for a descriptor.`
            throw new Error(msg);
        }

        // find a free name within the file
        let name = requestedName;
        let count = 0;
        while (this.hasNameInFile(name, file) && count < this.clashResolveMaxTries) {
            name = this.clashResolver(descriptor, file, requestedName, kind, ++count, name);
        }
        if (this.hasNameInFile(name, file)) {
            let msg = `Failed to register name "${requestedName}" for ${StringFormat.formatName(descriptor)}. `
                + `Gave up finding alternative name after ${this.clashResolveMaxTries} tries. `
                + `There is something wrong with the clash resolver.`;
            throw new Error(msg);
        }

        // add the entry and return name
        this.entries.push({file, descriptor, kind, name});
        return name;
    }


    /**
     * Find a symbol (of the given kind) for the given descriptor.
     * Return `undefined` if not found.
     */
    find(descriptor: AnyTypeDescriptorProto, kind = 'default'): SymbolTableEntry | undefined {
        return this.entries.find(e => e.descriptor === descriptor && e.kind === kind);
    }


    /**
     * Find a symbol (of the given kind) for the given descriptor.
     * Raises error if not found.
     */
    get(descriptor: AnyTypeDescriptorProto, kind = 'default'): SymbolTableEntry {
        const found = this.find(descriptor, kind);
        if (!found) {
            let files = this.entries.map(e => e.file)
                .filter((value, index, array) => array.indexOf(value) === index);
            let msg = `Failed to find name for ${StringFormat.formatName(descriptor)} of kind "${kind}". `
                + `Searched in ${files.length} files.`
            throw new Error(msg);
        }
        return found;
    }


    /**
     * Is a name (of the given kind) registered for the the given descriptor?
     */
    has(descriptor: AnyTypeDescriptorProto, kind?: string): boolean;

    /**
     * Is a name (of the given kind) registered for the given descriptor in the given file?
     */
    has(descriptor: AnyTypeDescriptorProto, file: GeneratedFile, kind?: string): boolean;

    has(descriptor: AnyTypeDescriptorProto, b: GeneratedFile | string = 'default', kind = 'default'): boolean {
        return this.find(descriptor, kind) !== undefined;
    }


    /**
     * List all names of any kind registered in the given file.
     */
    list(file: GeneratedFile): SymbolTableEntry[];

    /**
     * List all names of the given kind registered in the given file.
     */
    list(file: GeneratedFile, kind: string): SymbolTableEntry[];

    list(file: GeneratedFile, kind?: string): SymbolTableEntry[] {
        let matches = this.entries.filter(e => e.file === file);
        if (kind !== undefined) {
            matches = matches.filter(e => e.kind === kind);
        }
        return matches;
    }


    protected hasNameInFile = (name: string, file: GeneratedFile) =>
        this.entries.some(e => e.file === file && e.name === name);


    static defaultClashResolver(
        descriptor: AnyTypeDescriptorProto,
        file: GeneratedFile,
        requestedName: string,
        kind: string,
        tryCount: number,
    )
        : string {
        let n = requestedName;
        n = n.endsWith('$') ? n.substring(1) : n;
        return n + '$' + tryCount;
    }


}


interface SymbolTableEntry {
    file: GeneratedFile;
    descriptor: AnyTypeDescriptorProto;
    name: string;
    kind: string;
}


type ClashResolver = (descriptor: AnyTypeDescriptorProto, file: GeneratedFile, requestedName: string, kind: string, tryCount: number, failedName: string) => string;
