// Compatible cubic paths from stickeranimation idea/app.js. Keep their segment
// counts aligned with ghost.svg so the body and expressions morph continuously.
export const numbers = (path) => path.match(/-?\d*\.?\d+/g).map(Number);

export function createMoods(restingBody, openEye, smile) {
  const angryBody = numbers(`M138 200
    C138 171 142 139 153 114 C170 67 211 40 258 42
    C304 42 342 65 363 100 C377 127 383 160 383 203
    C402 208 416 217 413 234 C411 245 399 257 390 263
    C405 279 390 290 376 282 C376 300 396 327 385 340
    C377 351 360 352 346 348 C327 337 318 350 304 357
    C288 365 276 359 264 353 C250 344 239 359 222 360
    C201 362 197 344 183 339 C168 333 154 346 137 342
    C116 340 106 329 113 312 C117 300 127 286 130 281
    C120 279 116 271 126 262 C114 253 105 241 105 229
    C105 215 122 205 138 200 C138 200 138 200 138 200Z`);
  const sleepingBody = numbers(`M147 283
    C140 267 137 245 143 226 C153 192 192 166 230 157
    C267 146 301 153 323 174 C337 188 344 204 349 220
    C365 224 374 239 369 255 C367 264 360 270 350 273
    C352 283 347 291 336 294 C347 308 354 323 343 336
    C332 348 319 344 305 348 C286 356 282 365 266 368
    C249 375 238 371 222 370 C205 366 191 379 175 373
    C164 368 162 353 157 346 C149 353 145 349 152 329
    C138 329 133 323 134 313 C135 299 142 289 147 283
    C147 283 147 283 147 283 C147 283 147 283 147 283
    C147 283 147 283 147 283 C147 283 147 283 147 283Z`);
  const morningBody = numbers(`M117 242
    C109 211 117 167 134 133 C155 95 193 78 233 84
    C273 85 304 107 326 142 C343 171 351 198 353 226
    C374 237 381 251 376 267 C373 276 366 282 359 285
    C363 301 375 313 384 326 C397 346 378 362 353 357
    C335 351 331 353 319 364 C304 378 290 382 272 376
    C255 372 250 365 239 369 C221 375 213 383 193 376
    C180 372 175 360 163 360 C149 359 137 370 119 367
    C101 365 90 356 93 341 C96 327 120 312 126 304
    C130 298 118 302 108 297 C95 291 92 276 97 265
    C101 255 110 248 117 242 C117 242 117 242 117 242Z`);
  const closedEye = numbers('M234 163 C230 180 208 186 194 174 C189 169 193 162 199 165 C213 175 222 169 225 161 C229 156 236 157 234 163Z');
  const happyEye = numbers('M235 167 C227 141 202 143 192 166 C189 173 197 178 201 171 C210 153 225 156 227 171 C231 178 238 175 235 167Z');
  const heartEye = numbers('M214 185 C183 166 191 144 204 148 C210 148 213 153 214 156 C220 143 235 148 234 159 C235 170 221 180 214 185Z');
  const sternEye = numbers('M231 172 C233 188 225 201 213 201 C200 201 192 191 193 179 C194 168 200 165 210 169 C219 173 227 177 231 172Z');
  const frown = numbers('M250 204 C253 198 257 196 262 196 C268 196 273 199 276 204 C276 204 276 204 276 204');
  const sleepyMouth = numbers('M250 176 C253 184 260 185 264 178 C270 186 278 182 278 175 C278 175 278 175 278 175');

  // Personalize the messages here. Artwork and calendar notes are independent.
  return {
    idle: { label: 'Just deyam', body: restingBody, eye: openEye, mouth: smile, speech: 'No big plans. Just you and me.', description: 'A little float, a little blink. You can just be yourself here.' },
    hi: { label: 'Say hi', body: restingBody, eye: openEye, mouth: smile, speech: 'Hiii, deyam. There you are!', description: 'A tiny wave, because seeing you always makes the day better.' },
    happy: { label: 'Happy', body: restingBody, eye: happyEye, mouth: smile, speech: 'You’re here. Cue the happy dance!', description: 'For your little wins, your big smiles, and everything in between.' },
    love: { label: 'Love you', body: restingBody, eye: heartEye, mouth: smile, speech: 'A little lot of love, just for you.', description: 'Heart eyes and floating hearts. This one’s all yours, deyam.' },
    angry: { label: 'Angry', body: angryBody, eye: sternEye, mouth: frown, speech: 'Even grumpy deyam gets a hug.', description: 'Hands on hips. A very serious huff. Your messy days belong here, too.' },
    morning: { label: 'Good morning', body: morningBody, eye: happyEye, mouth: smile, speech: 'Good morning, sleepyhead.', description: 'A warm cup, a little sunshine, and a softer start to your day.' },
    gn: { label: 'Good night', body: sleepingBody, eye: closedEye, mouth: sleepyMouth, speech: 'Good night, deyam. Rest a little.', description: 'Nightcap on, tucked in. Let the world wait until tomorrow.' },
  };
}

export function cubicPath(points, close = true, xOffset = 0) {
  const coordinate = (index) => (points[index] + (index % 2 === 0 ? xOffset : 0)).toFixed(2);
  let path = `M${coordinate(0)} ${coordinate(1)}`;
  for (let index = 2; index < points.length; index += 6) {
    path += `C${Array.from({ length: 6 }, (_, offset) => coordinate(index + offset)).join(' ')}`;
  }
  return path + (close ? 'Z' : '');
}

export function wave(body, time, strength) {
  const cycle = time % 3000;
  const envelope = cycle < 2000 ? Math.sin(Math.PI * cycle / 2000) : 0;
  const lift = (20 + Math.sin(time / 105) * 18 * envelope) * strength;
  const points = [...body];
  for (const [segment, weights] of [[17, [.2, .45, .7]], [18, [.9, 1, 1]], [19, [.8, .35, 0]]]) {
    for (let pair = 0; pair < 3; pair++) {
      const index = 2 + segment * 6 + pair * 2;
      points[index] += Math.sin(time / 105) * 7 * envelope * weights[pair] * strength;
      points[index + 1] -= lift * weights[pair];
    }
  }
  return points;
}
