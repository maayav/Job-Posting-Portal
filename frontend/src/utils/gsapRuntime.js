let gsapRuntime;

/** Load animation code only when a page actually needs scroll effects. */
export function loadGsap() {
  if (!gsapRuntime) {
    gsapRuntime = Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
      .then(([gsapModule, scrollTriggerModule]) => {
        const gsap = gsapModule.gsap ?? gsapModule.default;
        const ScrollTrigger = scrollTriggerModule.ScrollTrigger;
        gsap.registerPlugin(ScrollTrigger);
        return { gsap, ScrollTrigger };
      })
      .catch((error) => {
        gsapRuntime = undefined;
        throw error;
      });
  }
  return gsapRuntime;
}
