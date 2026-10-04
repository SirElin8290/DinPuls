// Idempotent setup after Capacitor sync; no Apple credentials required.
import {readFile,writeFile} from 'node:fs/promises';
const path=new URL('../ios/App/App.xcodeproj/project.pbxproj',import.meta.url);
let p=await readFile(path,'utf8');
if(!p.includes('D1A000000000000000000001')){
 p=p.replace('/* Begin PBXBuildFile section */','/* Begin PBXBuildFile section */\n D1A000000000000000000001 = {isa = PBXBuildFile; productRef = D1A000000000000000000003; };\n D1A000000000000000000002 = {isa = PBXBuildFile; productRef = D1A000000000000000000004; };');
 p=p.replace('4D22ABE92AF431CB00220026 /* CapApp-SPM in Frameworks */,','4D22ABE92AF431CB00220026 /* CapApp-SPM in Frameworks */,\n D1A000000000000000000001, D1A000000000000000000002,');
 p=p.replace('4D22ABE82AF431CB00220026 /* CapApp-SPM */,','4D22ABE82AF431CB00220026 /* CapApp-SPM */,\n D1A000000000000000000003, D1A000000000000000000004,');
 p=p.replace('packageReferences = (','packageReferences = (\n D1A000000000000000000005,');
 p=p.replace('/* Begin XCSwiftPackageProductDependency section */','/* Begin XCRemoteSwiftPackageReference section */\n D1A000000000000000000005 = {isa = XCRemoteSwiftPackageReference; repositoryURL = "https://github.com/firebase/firebase-ios-sdk.git"; requirement = {kind = exactVersion; version = 12.19.1; }; };\n/* End XCRemoteSwiftPackageReference section */\n/* Begin XCSwiftPackageProductDependency section */\n D1A000000000000000000003 = {isa = XCSwiftPackageProductDependency; package = D1A000000000000000000005; productName = FirebaseCore; };\n D1A000000000000000000004 = {isa = XCSwiftPackageProductDependency; package = D1A000000000000000000005; productName = FirebaseMessaging; };');
}
p=p.replaceAll('CODE_SIGN_STYLE = Automatic;\n CODE_SIGN_ENTITLEMENTS = App/App.entitlements;','CODE_SIGN_STYLE = Automatic;');
p=p.replaceAll('CODE_SIGN_STYLE = Automatic;','CODE_SIGN_STYLE = Automatic;\n CODE_SIGN_ENTITLEMENTS = App/App.entitlements;');
if(!p.includes('APS_ENVIRONMENT = development;'))p=p.replace('SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;\n\t\t\t\tSWIFT_VERSION','APS_ENVIRONMENT = development;\n\t\t\t\tSWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;\n\t\t\t\tSWIFT_VERSION');
if(!p.includes('APS_ENVIRONMENT = production;'))p=p.replace('SWIFT_ACTIVE_COMPILATION_CONDITIONS = "";','APS_ENVIRONMENT = production;\n SWIFT_ACTIVE_COMPILATION_CONDITIONS = "";');
await writeFile(path,p);
if(process.env.DINPULS_IOS_CI==='1'){
 p=p.replace('SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;\n\t\t\t\tSWIFT_VERSION','SWIFT_ACTIVE_COMPILATION_CONDITIONS = "DEBUG IOS_CI";\n\t\t\t\tSWIFT_VERSION');
 await writeFile(path,p);
}
console.log('iOS prepared: Firebase Messaging and APNs entitlement; no signing credentials.');
