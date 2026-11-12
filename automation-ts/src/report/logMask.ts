import { maskBody } from './networkEvents';

/** an auth header, cookie or API key: its name stays, the whole rest of the line goes */
const HEADER = /\b(proxy-authorization|authorization|set-cookie|cookie|x-api-key|api[-_]?key)\s*[:=]\s*\S.*$/gim;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/g;
/** a signed token (JWT) written on its own */
const SIGNED = /\beyJ[\w-]*\.[\w-]+\.[\w-]+/g;
/** name=value / name: value of a password, token, secret, verification code, OTP or PIN (not inside another word) */
const NAMED = /(?<![A-Za-z0-9_])([a-z_]*(?:password|passwd|pwd|token|secret|verificationcode)|otp[a-z_]*|pin|pincode)(\s*[:=]\s*)(?!\*\*\*)([^\s,&;"}]+)/gi;

/**
 * A line of the phone's own log made safe for the run screen: no token, password, OTP, PIN, cookie or auth header leaves
 * the run - JSON bodies masked as the Network masks them (networkEvents.maskBody), the rest by name.
 */
export function maskLogText(text: string): string {
  return maskBody((text ?? '').replace(HEADER, '$1: ***').replace(BEARER, 'Bearer ***').replace(SIGNED, '***'))
    .replace(NAMED, '$1$2***');
}
