import type { NextConfig } from 'next';
const config:NextConfig={agentRules:false,devIndicators:false,transpilePackages:['@mvs/contracts'],async rewrites(){return [{source:'/api/:path*',destination:'http://127.0.0.1:3001/api/:path*'},{source:'/health/:path*',destination:'http://127.0.0.1:3001/health/:path*'}];}};
export default config;
